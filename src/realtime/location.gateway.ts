// Port of Zonic.Api/Hubs/LocationHub.cs (SignalR Hub → Nest WebSocket Gateway).
// Namespace: /hubs/location
//   in : StartRun, StopRun, SendLocation     out: Connected, RunStarted, RunStopped, ZoneUpdated
//
// SendLocation keeps the SignalR positional-argument contract
// (lat, lng, accuracy, speed, timestamp, runTypeId), so it is wired via a raw socket
// listener; StartRun/StopRun map cleanly to @SubscribeMessage.
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { encode } from '../common/helpers/geohash';
import { parseExactDateTime } from '../common/helpers/datetime';
import { ZONE_CAPTURE } from '../common/constants';
import { RunSessionService } from '../run-sessions/run-session.service';
import { ZonesService } from '../zones/zones.service';
import { LocationChannel } from './location.channel';
import { LocationBackgroundService } from './location-background.service';

@WebSocketGateway({ namespace: '/hubs/location', cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Namespace;

  private readonly logger = new Logger(LocationGateway.name);

  // Mirror the static ConcurrentDictionary fields (gateway is a singleton).
  private readonly lastUpdate = new Map<string, number>();
  private readonly connectionGroups = new Map<string, string>();

  constructor(
    private readonly channel: LocationChannel,
    private readonly runSessionService: RunSessionService,
    private readonly zonesService: ZonesService,
    private readonly background: LocationBackgroundService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    // [Authorize] is commented out in the original hub — unauthenticated sockets may
    // still connect; user-scoped actions are no-ops without a user id.
    client.data.userId = this.authenticate(client);
    console.log(`CONNECTED: ${client.id}`);
    client.emit('Connected', client.id);

    // SendLocation — accept ANY shape the client sends:
    //   positional:  emit('SendLocation', lat, lng, accuracy, speed, ts, runTypeId)
    //   array:       emit('SendLocation', [lat, lng, accuracy, speed, ts, runTypeId])
    //   object:      emit('SendLocation', { lat, lng, accuracy, speed, timestamp, runTypeId })
    client.on('SendLocation', (...args: unknown[]) => {
      const p = LocationGateway.parseLocationArgs(args);
      if (p) {
        this.sendLocation(client, p.lat, p.lng, p.accuracy, p.speed, p.timestamp, p.runTypeId);
      }
    });
  }

  /** Normalise the three accepted SendLocation shapes into one object. */
  private static parseLocationArgs(args: unknown[]): {
    lat: number; lng: number; accuracy: number; speed: number; timestamp: string; runTypeId: number;
  } | null {
    let src: unknown[] | Record<string, unknown>;
    const first = args[0];
    if (Array.isArray(first)) src = first as unknown[];
    else if (first && typeof first === 'object') src = first as Record<string, unknown>;
    else src = args;

    const get = (arr: unknown[], i: number, obj: Record<string, unknown>, key: string): unknown =>
      Array.isArray(src) ? arr[i] : obj[key];

    const a = src as unknown[];
    const o = src as Record<string, unknown>;
    const num = (v: unknown): number => Number(v);
    const lat = num(get(a, 0, o, 'lat'));
    const lng = num(get(a, 1, o, 'lng'));
    const accuracy = num(get(a, 2, o, 'accuracy'));
    const speed = num(get(a, 3, o, 'speed'));
    const tsRaw = get(a, 4, o, 'timestamp');
    const runTypeId = num(get(a, 5, o, 'runTypeId'));
    const timestamp = typeof tsRaw === 'string' ? tsRaw : String(tsRaw ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, accuracy, speed, timestamp, runTypeId };
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const group = this.connectionGroups.get(client.id);
    if (group !== undefined) {
      this.connectionGroups.delete(client.id);
      client.leave(group);
    }

    const userId = this.getUserId(client);
    if (userId != null) {
      this.lastUpdate.delete(userId);
      // NOTE: we intentionally do NOT end/delete the run here. A brief network drop
      // (or a reconnect after a warning) must not wipe an in-progress run. The run
      // survives until it's finished (captured) or replaced by the next StartRun.
      // Unfinished runs never enter history (they have no ended_at).
    }
  }

  @SubscribeMessage('StartRun')
  async startRun(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const userId = this.getUserId(client);
    if (userId == null) return;

    // Accept 1, [1] or { runTypeId: 1 }.
    let runTypeId = Number(body);
    if (Array.isArray(body)) runTypeId = Number(body[0]);
    else if (body && typeof body === 'object') {
      runTypeId = Number((body as Record<string, unknown>).runTypeId);
    }
    if (!Number.isFinite(runTypeId)) runTypeId = ZONE_CAPTURE;

    const sessionId = await this.runSessionService.startRun(userId, runTypeId);
    client.emit('RunStarted', sessionId);
  }

  @SubscribeMessage('StopRun')
  async stopRun(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = this.getUserId(client);
    if (userId == null) return;

    // Everything is wrapped so a failure NEVER tears down the socket — the client
    // always gets a definite result event instead of a silent disconnect.
    try {
      // Make sure the last GPS points are written before we read the path,
      // otherwise a freshly-sent closing point may be missed (false "not closed").
      await this.background.waitUntilFlushed();

      const session = await this.runSessionService.getActiveSession(userId);
      if (!session) {
        client.emit('RunStopped');
        return;
      }

      // Non-capture runs (e.g. Free Run) just end.
      if (session.runTypeId !== ZONE_CAPTURE) {
        await this.runSessionService.finalizeRun(session);
        client.emit('RunStopped');
        return;
      }

      // Try to capture from the path so far (session is NOT ended yet).
      const result = await this.zonesService.captureFromRun({
        userId,
        runTypeId: session.runTypeId,
        startedAt: new Date(session.startedAt),
        endedAt: new Date(),
      });

      if (!result.saved || result.zoneId == null) {
        // Capture failed → KEEP the run active so the user can keep running and
        // press Finish again. Nothing is ended or deleted; only a warning is sent.
        if (!result.closed) client.emit('ZoneNotClosed'); // loop not closed (≤150m)
        else if (result.reason === 'tooShort') {
          client.emit('ZoneTooShort', { minMeters: this.minRunMeters(), ranMeters: result.ranMeters });
        } else client.emit('ZoneNotCaptured'); // closed but blocked
        return;
      }

      // Success → end the run and report it.
      await this.runSessionService.finalizeRun(session);
      client.emit('RunStopped');
      client.emit('ZoneCaptured', { zoneId: result.zoneId, areaKm2: result.areaKm2 });

      // Broadcast the new polygon to the geo group around its centroid.
      const groupPrecision = (this.config.get('game') as { groupPrecision: number }).groupPrecision;
      const groupKey = `geo:${encode(result.centroidLat!, result.centroidLng!, groupPrecision)}`;
      const items = await this.zonesService.getZoneItem(result.zoneId);
      this.server.to(groupKey).emit('ZoneUpdated', items);
    } catch (err) {
      this.logger.error(`StopRun failed for user ${userId}: ${(err as Error).message}`);
      client.emit('ZoneNotCaptured', { reason: 'server_error' });
    }
  }

  private minRunMeters(): number {
    return (this.config.get('game') as { minRunDistanceM: number }).minRunDistanceM;
  }

  private async sendLocation(
    client: Socket,
    lat: number,
    lng: number,
    accuracy: number,
    speed: number,
    timestamp: string,
    runTypeId: number,
  ): Promise<void> {
    const userId = this.getUserId(client);
    if (userId == null) return;

    const game = this.config.get('game') as {
      rateLimitSeconds: number;
      minAccuracyMeters: number;
      groupPrecision: number;
    };

    // Rate limit
    const now = Date.now();
    const last = this.lastUpdate.get(userId);
    if (last !== undefined && (now - last) / 1000 < game.rateLimitSeconds) return;
    this.lastUpdate.set(userId, now);

    // Coordinate validation
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    // Accuracy filter
    if (accuracy > game.minAccuracyMeters) return;

    // Geo group membership
    const geohash = encode(lat, lng, game.groupPrecision);
    const groupKey = `geo:${geohash}`;

    const currentGroup = this.connectionGroups.get(client.id);
    if (currentGroup !== undefined) {
      if (currentGroup !== groupKey) {
        client.leave(currentGroup);
        client.join(groupKey);
        this.connectionGroups.set(client.id, groupKey);
      }
    } else {
      client.join(groupKey);
      this.connectionGroups.set(client.id, groupKey);
    }

    // Parse "dd.MM.yyyy HH:mm:ss"
    const parsedTime = parseExactDateTime(timestamp);
    if (parsedTime === null) return;

    this.channel.write({
      userId,
      latitude: lat,
      longitude: lng,
      accuracy,
      speed,
      timestamp: parsedTime,
      runTypeId,
    });
  }

  /** Broadcast helper used by LocationBackgroundService. */
  broadcastZoneUpdated(groupKey: string, zones: Array<{ geohash: string; userId: string }>): void {
    this.server.to(groupKey).emit('ZoneUpdated', zones);
  }

  private getUserId(client: Socket): string | null {
    return (client.data.userId as string | null) ?? null;
  }

  private authenticate(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, string | undefined>;
    const queryParams = client.handshake.query as Record<string, string | string[] | undefined>;
    const token =
      auth?.access_token ||
      auth?.token ||
      (queryParams?.access_token as string | undefined);
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: this.config.get<string>('jwt.secretKey'),
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
        algorithms: ['HS256'],
      });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}
