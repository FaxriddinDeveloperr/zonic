// Port of Zonic.Api/Services/LocationBackgroundService.cs (BackgroundService consumer).
// Nest lifecycle: starts on OnApplicationBootstrap, stops on OnModuleDestroy.
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { encode, haversineDistance } from '../common/helpers/geohash';
import { GameConfig } from '../config/configuration';
import { LocationPoint } from '../entities/location-point.entity';
import { UserLocation } from '../entities/user-location.entity';
import { LocationChannel, LocationUpdate } from './location.channel';
import { LocationGateway } from './location.gateway';

const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });

@Injectable()
export class LocationBackgroundService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LocationBackgroundService.name);
  private readonly game: GameConfig;
  private readonly abort = new AbortController();
  private loop?: Promise<void>;

  constructor(
    private readonly channel: LocationChannel,
    private readonly gateway: LocationGateway,
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.game = config.get<GameConfig>('game')!;
  }

  onApplicationBootstrap(): void {
    this.loop = this.executeAsync(this.abort.signal);
  }

  async onModuleDestroy(): Promise<void> {
    this.abort.abort();
    await this.loop?.catch(() => undefined);
  }

  private async executeAsync(signal: AbortSignal): Promise<void> {
    this.logger.log('LocationBackgroundService started');
    while (!signal.aborted) {
      try {
        const batch = await this.readBatch(signal);
        if (batch.length > 0) {
          await this.processBatch(batch);
        }
      } catch (err) {
        if (signal.aborted) break;
        this.logger.error('Error processing location batch', (err as Error).message);
        await delay(1000, signal);
      }
    }
    this.logger.log('LocationBackgroundService stopped');
  }

  private async readBatch(signal: AbortSignal): Promise<LocationUpdate[]> {
    const batch: LocationUpdate[] = [];
    const { batchSize, batchIntervalMs } = this.game;

    const ok = await this.channel.waitToRead(signal);
    if (!ok || signal.aborted) return batch;

    let item: LocationUpdate | null;
    while (batch.length < batchSize && (item = this.channel.tryRead()) !== null) {
      batch.push(item);
    }

    if (batch.length < batchSize) {
      const intervalAbort = new AbortController();
      const timer = setTimeout(() => intervalAbort.abort(), batchIntervalMs);
      const onParentAbort = () => intervalAbort.abort();
      signal.addEventListener('abort', onParentAbort, { once: true });

      try {
        while (batch.length < batchSize && !intervalAbort.signal.aborted) {
          const more = await this.channel.waitToRead(intervalAbort.signal);
          if (!more) break;
          while (batch.length < batchSize && (item = this.channel.tryRead()) !== null) {
            batch.push(item);
          }
        }
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', onParentAbort);
      }
    }

    return batch;
  }

  // Ingests GPS points (+ anti-cheat) and tracks last-known user location.
  // Zone capture is NOT done here anymore — it happens once at StopRun
  // (whole run path → PostGIS polygon) in ZonesService.captureFromRun.
  private async processBatch(batch: LocationUpdate[]): Promise<void> {
    const { maxSpeedMps, zonePrecision } = this.game;

    await this.dataSource.transaction(async (manager) => {
      const validPoints: Partial<LocationPoint>[] = [];
      const userUpdates = new Map<string, LocationUpdate>();

      for (const update of batch) {
        // Speed check
        if (update.speed > maxSpeedMps) continue;

        // Jump detection vs last known position
        const last = await manager.findOne(UserLocation, { where: { userId: update.userId } });
        if (last) {
          const distance = haversineDistance(
            last.latitude, last.longitude, update.latitude, update.longitude,
          );
          const elapsed = (update.timestamp.getTime() - new Date(last.updatedAt).getTime()) / 1000;
          if (elapsed > 0 && distance / elapsed > maxSpeedMps * 2) continue;
        }

        validPoints.push({
          userId: update.userId,
          latitude: update.latitude,
          longitude: update.longitude,
          accuracy: update.accuracy,
          speed: update.speed,
          recordedAt: update.timestamp,
        });

        userUpdates.set(update.userId, update);
      }

      if (validPoints.length === 0) return;

      // Batch insert location points
      await manager.insert(LocationPoint, validPoints);

      // Upsert user locations
      for (const [userId, update] of userUpdates) {
        const geohash = encode(update.latitude, update.longitude, zonePrecision);
        await manager.upsert(
          UserLocation,
          {
            userId,
            latitude: update.latitude,
            longitude: update.longitude,
            accuracy: update.accuracy,
            speed: update.speed,
            geohash,
            updatedAt: new Date(),
          },
          ['userId'],
        );
      }
    });
  }
}
