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
import { LeaderboardRequestDto, LeaderboardScope } from './dto/leaderboard-request.dto';
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
    // Discard any leftover unfinished run so a user only ever has one active session.
    await this.sessions.delete({ userId, endedAt: IsNull() });

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

  /** The user's current unfinished run, if any. Does NOT end it. */
  async getActiveSession(userId: string): Promise<RunSession | null> {
    return this.sessions.findOne({
      where: { userId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
  }

  /** End a run: stamp ended_at and store the computed distance/speed. */
  async finalizeRun(session: RunSession): Promise<RunSession> {
    const endedAt = new Date();

    const points = await this.points.find({
      where: { userId: session.userId, recordedAt: Between(session.startedAt, endedAt) },
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
    return this.sessions.save(session);
  }

  /** Discard the user's unfinished run (disconnect / premature cancel) — keep no history. */
  async cancelRun(userId: string): Promise<void> {
    await this.sessions.delete({ userId, endedAt: IsNull() });
  }

  /** Remove a specific run session (e.g. a zone run that failed to capture). */
  async deleteSession(sessionId: string): Promise<void> {
    await this.sessions.delete({ id: sessionId });
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

  /**
   * Leaderboard ranked by total distance. `scope` (Phase H) narrows the ranking to the caller's
   * own country/region; 'global' (or an anonymous caller) ranks everyone. The region filter joins
   * sys_user and matches the caller's country_id/region_id — so callers without a profile region
   * simply get an empty board for that scope rather than an error.
   */
  async getLeaderboard(
    request: LeaderboardRequestDto,
    userId?: string,
  ): Promise<LeaderboardResponseDto> {
    const page = request.page && request.page > 0 ? request.page : 1;
    const pageSize = request.pageSize && request.pageSize > 0 ? request.pageSize : 20;
    const scope = request.scope ?? LeaderboardScope.Global;

    // Resolve the geo filter from the caller's profile.
    let filterSql = '';
    const filterParams: unknown[] = [];
    if (scope !== LeaderboardScope.Global && userId) {
      const me: Array<{ country_id: number | null; region_id: number | null }> =
        await this.sessions.manager.query(
          'SELECT country_id, region_id FROM sys_user WHERE id = $1',
          [userId],
        );
      const meRow = me[0];
      if (scope === LeaderboardScope.Country) {
        // No country on profile → empty board (nothing to compare against).
        if (meRow?.country_id == null) return { totalCount: 0, page, pageSize, items: [] };
        filterSql = 'AND u.country_id = $1';
        filterParams.push(meRow.country_id);
      } else {
        if (meRow?.region_id == null) return { totalCount: 0, page, pageSize, items: [] };
        filterSql = 'AND u.region_id = $1';
        filterParams.push(meRow.region_id);
      }
    }

    const countRows: Array<{ cnt: string }> = await this.sessions.manager.query(
      `SELECT COUNT(DISTINCT s.user_id) AS cnt
         FROM game_run_session s
         JOIN sys_user u ON u.id = s.user_id
        WHERE s.ended_at IS NOT NULL ${filterSql}`,
      filterParams,
    );
    const totalCount = Number(countRows[0]?.cnt ?? 0);

    const offset = (page - 1) * pageSize;
    const rows: Array<{ username: string; totaldistance: string }> =
      await this.sessions.manager.query(
        `SELECT u.username AS username, SUM(s.total_distance_meters) AS totaldistance
           FROM game_run_session s
           JOIN sys_user u ON u.id = s.user_id
          WHERE s.ended_at IS NOT NULL ${filterSql}
          GROUP BY u.id, u.username
          ORDER BY SUM(s.total_distance_meters) DESC
          LIMIT ${pageSize} OFFSET ${offset}`,
        filterParams,
      );

    let rank = offset + 1;
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
