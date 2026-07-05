// Free run persistence + history/leaderboard queries.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FreeRun, RoutePoint } from '../entities/free-run.entity';
import { User } from '../entities/user.entity';
import { GameConfig } from '../config/configuration';
import { WalletService } from '../wallet/wallet.service';
import { haversineDistance } from '../common/helpers/geohash';
import { formatIso, parseFlexibleDateTime } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { SaveFreeRunDto } from './dto/save-free-run.dto';
import { LeaderboardScope } from '../run-sessions/dto/leaderboard-request.dto';
import {
  FreeRunHistoryResponseDto,
  FreeRunItemDto,
  FreeRunLeaderboardResponseDto,
} from './dto/free-run-response.dto';

const round = (v: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

@Injectable()
export class FreeRunService {
  private readonly minDistanceM: number;

  constructor(
    @InjectRepository(FreeRun) private readonly freeRuns: Repository<FreeRun>,
    private readonly wallet: WalletService,
    config: ConfigService,
  ) {
    this.minDistanceM = config.get<GameConfig>('game')!.minFreeRunDistanceM;
  }

  async save(userId: string, dto: SaveFreeRunDto): Promise<{ id: string }> {
    const startedAt = parseFlexibleDateTime(dto.startTime);
    const endedAt = parseFlexibleDateTime(dto.endTime);
    if (!startedAt) throw badRequest(['startTime is not a valid date.']);
    if (!endedAt) throw badRequest(['endTime is not a valid date.']);

    // Normalise route points: keep lat/lng, re-emit ts as ISO so reads are uniform.
    const routePoints: RoutePoint[] = (dto.routePoints ?? []).map((p) => {
      const t = parseFlexibleDateTime(p.ts);
      return { lat: p.lat, lng: p.lng, ts: t ? formatIso(t) : p.ts };
    });

    const distanceKm = FreeRunService.computeDistanceKm(
      routePoints,
      dto.averageSpeedKmh,
      dto.durationSeconds,
    );

    // Don't store runs shorter than the minimum (filters trivial/noise runs).
    if (distanceKm * 1000 < this.minDistanceM) {
      throw badRequest([`Free run too short — minimum ${this.minDistanceM} m required.`]);
    }

    const saved = await this.freeRuns.save(
      this.freeRuns.create({
        userId,
        startedAt,
        endedAt,
        durationSeconds: dto.durationSeconds,
        paceMinPerKm: dto.paceMinPerKm ?? 0,
        averageSpeedKmh: dto.averageSpeedKmh ?? 0,
        distanceKm,
        routePoints,
      }),
    );

    // Automatic coin/XP earning: credit for the distance run.
    await this.wallet.creditForActivity(userId, { km: distanceKm });

    return { id: saved.id };
  }

  async getHistory(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<FreeRunHistoryResponseDto> {
    const rows = await this.freeRuns.find({
      where: { userId },
      order: { startedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items: rows.map(FreeRunService.toItem) };
  }

  async getLeaderboard(
    page: number,
    pageSize: number,
    scope: LeaderboardScope,
    callerId: string,
  ): Promise<FreeRunLeaderboardResponseDto> {
    // Region scope: rank only users in the caller's country/region (GLOBAL/UZBEKISTAN/TASHKENT tabs).
    let countryId: number | null = null;
    let regionId: number | null = null;
    if (scope !== LeaderboardScope.Global) {
      const [me] = await this.freeRuns.manager.query(
        `SELECT country_id, region_id FROM sys_user WHERE id = $1`,
        [callerId],
      );
      if (scope === LeaderboardScope.Country) {
        if (me?.country_id == null) return { items: [] };
        countryId = Number(me.country_id);
      } else {
        if (me?.region_id == null) return { items: [] };
        regionId = Number(me.region_id);
      }
    }

    const qb = this.freeRuns
      .createQueryBuilder('r')
      .innerJoin(User, 'u', 'u.id = r.user_id')
      .select('u.id', 'userid')
      .addSelect('u.zonic_id', 'zonicid')
      .addSelect('u.username', 'username')
      .addSelect('u.avatar_file_id', 'avatarfileid')
      .addSelect('SUM(r.distance_km)', 'totaldistance')
      .addSelect('COUNT(*)', 'totalruns')
      .addSelect('MIN(NULLIF(r.pace_min_per_km, 0))', 'bestpace')
      .addSelect('AVG(r.average_speed_kmh)', 'avgspeed')
      .groupBy('u.id')
      .addGroupBy('u.zonic_id')
      .addGroupBy('u.username')
      .addGroupBy('u.avatar_file_id')
      .orderBy('SUM(r.distance_km)', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize);
    if (countryId != null) qb.andWhere('u.country_id = :cid', { cid: countryId });
    if (regionId != null) qb.andWhere('u.region_id = :rid', { rid: regionId });
    const rows = await qb
      .getRawMany<{
        userid: string;
        zonicid: number | null;
        username: string;
        avatarfileid: string | null;
        totaldistance: string;
        totalruns: string;
        bestpace: string | null;
        avgspeed: string | null;
      }>();

    let rank = (page - 1) * pageSize + 1;
    const items = rows.map((x) => ({
      rank: rank++,
      userId: x.userid,
      zonicId: x.zonicid,
      username: x.username,
      avatarFileId: x.avatarfileid,
      totalDistanceKm: round(Number(x.totaldistance ?? 0), 2),
      totalRuns: Number(x.totalruns ?? 0),
      bestPaceMinPerKm: x.bestpace == null ? 0 : round(Number(x.bestpace), 2),
      averageSpeedKmh: x.avgspeed == null ? 0 : round(Number(x.avgspeed), 2),
    }));

    return { items };
  }

  /** Distance from the route (haversine); falls back to avgSpeed × duration if too few points. */
  private static computeDistanceKm(
    points: RoutePoint[],
    averageSpeedKmh: number | undefined,
    durationSeconds: number,
  ): number {
    if (points.length >= 2) {
      let meters = 0;
      for (let i = 1; i < points.length; i++) {
        meters += haversineDistance(
          points[i - 1].lat,
          points[i - 1].lng,
          points[i].lat,
          points[i].lng,
        );
      }
      return round(meters / 1000, 3);
    }
    if (averageSpeedKmh && durationSeconds > 0) {
      return round(averageSpeedKmh * (durationSeconds / 3600), 3);
    }
    return 0;
  }

  private static toItem(r: FreeRun): FreeRunItemDto {
    return {
      id: r.id,
      startTime: formatIso(new Date(r.startedAt)),
      endTime: formatIso(new Date(r.endedAt)),
      durationSeconds: r.durationSeconds,
      paceMinPerKm: r.paceMinPerKm,
      averageSpeedKmh: r.averageSpeedKmh,
      distanceKm: r.distanceKm,
      routePoints: (r.routePoints ?? []).map((p) => ({ lat: p.lat, lng: p.lng, ts: p.ts })),
    };
  }
}
