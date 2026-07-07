// Free run persistence + history/leaderboard queries.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FreeRun, RoutePoint } from '../entities/free-run.entity';
import { User } from '../entities/user.entity';
import { FreeRunConfig, GameConfig } from '../config/configuration';
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
  private readonly gpsFilter: FreeRunConfig;

  constructor(
    @InjectRepository(FreeRun) private readonly freeRuns: Repository<FreeRun>,
    private readonly wallet: WalletService,
    config: ConfigService,
  ) {
    this.minDistanceM = config.get<GameConfig>('game')!.minFreeRunDistanceM;
    this.gpsFilter = config.get<FreeRunConfig>('freeRun')!;
  }

  async save(userId: string, dto: SaveFreeRunDto): Promise<{ id: string }> {
    const startedAt = parseFlexibleDateTime(dto.startTime);
    const endedAt = parseFlexibleDateTime(dto.endTime);
    if (!startedAt) throw badRequest(['startTime is not a valid date.']);
    if (!endedAt) throw badRequest(['endTime is not a valid date.']);

    // Distance from a GPS-cleaned route (drop poor accuracy / teleports / stationary jitter).
    const distanceKm = FreeRunService.computeDistanceKm(
      dto.routePoints ?? [],
      dto.averageSpeedKmh,
      dto.durationSeconds,
      this.gpsFilter,
    );

    // Don't store runs shorter than the minimum (filters trivial/noise runs).
    if (distanceKm * 1000 < this.minDistanceM) {
      throw badRequest([`Free run too short — minimum ${this.minDistanceM} m required.`]);
    }

    // Recompute pace/speed server-side from the CLEANED distance + elapsed time (don't trust the
    // client's numbers). Fall back to what was sent only when there's no usable route.
    const dur = dto.durationSeconds;
    const hasRoute = (dto.routePoints?.length ?? 0) >= 2;
    const averageSpeedKmh =
      hasRoute && dur > 0 && distanceKm > 0 ? round(distanceKm / (dur / 3600), 2) : dto.averageSpeedKmh ?? 0;
    const paceMinPerKm =
      hasRoute && dur > 0 && distanceKm > 0 ? round(dur / 60 / distanceKm, 2) : dto.paceMinPerKm ?? 0;

    // Normalise route points for storage: keep lat/lng, re-emit ts as ISO so reads are uniform.
    const routePoints: RoutePoint[] = (dto.routePoints ?? []).map((p) => {
      const t = parseFlexibleDateTime(p.ts);
      return { lat: p.lat, lng: p.lng, ts: t ? formatIso(t) : p.ts };
    });

    const saved = await this.freeRuns.save(
      this.freeRuns.create({
        userId,
        startedAt,
        endedAt,
        durationSeconds: dur,
        paceMinPerKm,
        averageSpeedKmh,
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
  /**
   * GPS-cleaned distance. Steps: (1) drop points whose accuracy is worse than maxAccuracyM,
   * (2) walk consecutive points from a moving anchor — skip a hop if the implied speed exceeds
   * maxSpeedMps (teleport/glitch) or the hop is shorter than minSegmentM (stationary jitter).
   * Only the accepted hops are summed. Falls back to avgSpeed×duration when there's no usable route.
   */
  private static computeDistanceKm(
    points: Array<{ lat: number; lng: number; ts: string; accuracy?: number }>,
    averageSpeedKmh: number | undefined,
    durationSeconds: number,
    f: FreeRunConfig,
  ): number {
    const good = points.filter((p) => p.accuracy == null || p.accuracy <= f.maxAccuracyM);
    if (good.length >= 2) {
      let meters = 0;
      let anchor = good[0];
      let anchorMs = FreeRunService.tsMs(anchor.ts);
      for (let i = 1; i < good.length; i++) {
        const cur = good[i];
        const d = haversineDistance(anchor.lat, anchor.lng, cur.lat, cur.lng);
        const curMs = FreeRunService.tsMs(cur.ts);
        const dtSec = anchorMs != null && curMs != null ? (curMs - anchorMs) / 1000 : 0;
        if (dtSec > 0 && d / dtSec > f.maxSpeedMps) continue; // teleport → ignore, keep anchor
        if (d < f.minSegmentM) continue; // stationary jitter → ignore, keep anchor
        meters += d;
        anchor = cur;
        anchorMs = curMs;
      }
      return round(meters / 1000, 3);
    }
    if (averageSpeedKmh && durationSeconds > 0) {
      return round(averageSpeedKmh * (durationSeconds / 3600), 3);
    }
    return 0;
  }

  private static tsMs(ts: string): number | null {
    const t = parseFlexibleDateTime(ts);
    return t ? t.getTime() : null;
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
