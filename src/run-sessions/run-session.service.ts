// Port of Zonic.ServiceLayer/Game/RunSessionServices/RunSessionService.cs
// (user id is passed in explicitly — works for both HTTP and the WebSocket gateway).
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { RunSession } from '../entities/run-session.entity';
import { LocationPoint } from '../entities/location-point.entity';
import { User } from '../entities/user.entity';
import { haversineDistance } from '../common/helpers/geohash';
import { formatDate, formatDuration, formatHourMinute } from '../common/helpers/datetime';
import { RunHistoryRequestDto } from './dto/run-history-request.dto';
import { LeaderboardRequestDto } from './dto/leaderboard-request.dto';
import { RunHistoryResponseDto, RunSummaryDto } from './dto/run-history-response.dto';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';

const round = (v: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

@Injectable()
export class RunSessionService {
  constructor(
    @InjectRepository(RunSession) private readonly sessions: Repository<RunSession>,
    @InjectRepository(LocationPoint) private readonly points: Repository<LocationPoint>,
  ) {}

  async startRun(userId: string, runTypeId: number): Promise<string> {
    const saved = await this.sessions.save(
      this.sessions.create({
        userId,
        runTypeId,
        startedAt: new Date(),
        totalDistanceMeters: 0,
        avgSpeedKmh: 0,
      }),
    );
    return saved.id;
  }

  async stopRun(userId: string): Promise<void> {
    const session = await this.sessions.findOne({
      where: { userId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
    if (!session) return;

    const endedAt = new Date();

    const points = await this.points.find({
      where: { userId, recordedAt: Between(session.startedAt, endedAt) },
      order: { recordedAt: 'ASC' },
    });

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += haversineDistance(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude,
      );
    }

    const durationSeconds = (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000;
    const avgSpeedKmh = durationSeconds > 0 ? totalDistance / 1000.0 / (durationSeconds / 3600.0) : 0;

    session.endedAt = endedAt;
    session.totalDistanceMeters = totalDistance;
    session.avgSpeedKmh = round(avgSpeedKmh, 2);
    await this.sessions.save(session);
  }

  async getRunHistory(
    userId: string,
    request: RunHistoryRequestDto,
  ): Promise<RunHistoryResponseDto> {
    const from = RunSessionService.getFromDate(request);

    const sessions = await this.sessions.find({
      where: { userId, endedAt: Not(IsNull()), startedAt: MoreThanOrEqual(from) },
      relations: { runType: true },
      order: { startedAt: 'DESC' },
    });

    const runs = sessions.map((r) => {
      const started = new Date(r.startedAt);
      const ended = new Date(r.endedAt as Date);
      return {
        date: formatDate(started),
        startedAt: formatHourMinute(started),
        duration: formatDuration(ended.getTime() - started.getTime()),
        distance: round(r.totalDistanceMeters / 1000.0, 2),
        avgSpeed: round(r.avgSpeedKmh, 1),
        runType: r.runType?.displayName ?? '',
      };
    });

    return { runs, summary: RunSessionService.buildSummary(sessions) };
  }

  async getLeaderboard(request: LeaderboardRequestDto): Promise<LeaderboardResponseDto> {
    const page = request.page && request.page > 0 ? request.page : 1;
    const pageSize = request.pageSize && request.pageSize > 0 ? request.pageSize : 20;

    const countRaw = await this.sessions
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.user_id)', 'cnt')
      .where('s.ended_at IS NOT NULL')
      .getRawOne<{ cnt: string }>();
    const totalCount = Number(countRaw?.cnt ?? 0);

    const rows = await this.sessions
      .createQueryBuilder('s')
      .innerJoin(User, 'u', 'u.id = s.user_id')
      .select('u.username', 'username')
      .addSelect('SUM(s.total_distance_meters)', 'totaldistance')
      .where('s.ended_at IS NOT NULL')
      .groupBy('u.id')
      .orderBy('SUM(s.total_distance_meters)', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{ username: string; totaldistance: string }>();

    let rank = (page - 1) * pageSize + 1;
    const items = rows.map((x) => ({
      rank: rank++,
      username: x.username,
      totalDistance: round(Number(x.totaldistance) / 1000.0, 2),
    }));

    return { totalCount, page, pageSize, items };
  }

  private static getFromDate(request: RunHistoryRequestDto): Date {
    const now = Date.now();
    if (request.isWeekly) return new Date(now - 7 * 86_400_000);
    if (request.isMonthly) return new Date(now - 30 * 86_400_000);
    if (request.isYearly) return new Date(now - 365 * 86_400_000);
    return new Date(now - 30 * 86_400_000); // default: monthly
  }

  private static buildSummary(sessions: RunSession[]): RunSummaryDto {
    if (sessions.length === 0) {
      return { avgSpeed: 0, avgDistance: 0, avgDuration: '00:00:00' };
    }
    const avg = (fn: (r: RunSession) => number): number =>
      sessions.reduce((s, r) => s + fn(r), 0) / sessions.length;

    const avgSpeed = avg((r) => r.avgSpeedKmh);
    const avgDistance = avg((r) => r.totalDistanceMeters / 1000.0);
    const avgDurationMs = avg(
      (r) => new Date(r.endedAt as Date).getTime() - new Date(r.startedAt).getTime(),
    );

    return {
      avgSpeed: round(avgSpeed, 1),
      avgDistance: round(avgDistance, 2),
      avgDuration: formatDuration(avgDurationMs),
    };
  }
}
