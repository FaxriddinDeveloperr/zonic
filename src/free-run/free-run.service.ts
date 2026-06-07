// Free run persistence + history/leaderboard queries.
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FreeRun, RoutePoint } from '../entities/free-run.entity';
import { User } from '../entities/user.entity';
import { haversineDistance } from '../common/helpers/geohash';
import { formatIso, parseFlexibleDateTime } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { SaveFreeRunDto } from './dto/save-free-run.dto';
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
  constructor(
    @InjectRepository(FreeRun) private readonly freeRuns: Repository<FreeRun>,
  ) {}

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
  ): Promise<FreeRunLeaderboardResponseDto> {
    const rows = await this.freeRuns
      .createQueryBuilder('r')
      .innerJoin(User, 'u', 'u.id = r.user_id')
      .select('u.id', 'userid')
      .addSelect('u.username', 'username')
      .addSelect('SUM(r.distance_km)', 'totaldistance')
      .addSelect('COUNT(*)', 'totalruns')
      .addSelect('MIN(NULLIF(r.pace_min_per_km, 0))', 'bestpace')
      .addSelect('AVG(r.average_speed_kmh)', 'avgspeed')
      .groupBy('u.id')
      .addGroupBy('u.username')
      .orderBy('SUM(r.distance_km)', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{
        userid: string;
        username: string;
        totaldistance: string;
        totalruns: string;
        bestpace: string | null;
        avgspeed: string | null;
      }>();

    let rank = (page - 1) * pageSize + 1;
    const items = rows.map((x) => ({
      rank: rank++,
      userId: x.userid,
      username: x.username,
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
