// Profile Statistics (A), Personal Bests (B) and Achievements (C).
// All read-only over existing data — running = game_free_run, territory = game_territory —
// so nothing here touches the run/free-run/territory write paths. The only write is a lazy
// INSERT into game_user_achievement the first time a badge's threshold is crossed (records the
// unlock date); it never deletes, so an unlocked badge stays unlocked.
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatDate, formatDuration } from '../common/helpers/datetime';
import {
  ALL_ACHIEVEMENTS,
  DISTANCE_ACHIEVEMENTS,
  TERRITORY_ACHIEVEMENTS,
  AchievementDef,
} from '../common/achievements';
import { StatsDimension, StatsPeriod } from './dto/stats-query.dto';
import { StatsResponseDto, StatsSummaryDto } from './dto/stats-response.dto';
import { PersonalBestsResponseDto, PersonalBestDto } from './dto/personal-bests.dto';
import { AchievementsResponseDto, AchievementDto } from './dto/achievements.dto';

const round = (v: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

const emptySummary = (): StatsSummaryDto => ({
  activityCount: 0,
  totalDistanceKm: 0,
  avgDistanceKm: 0,
  avgSpeedKmh: 0,
  avgPaceMinPerKm: 0,
  totalDurationSeconds: 0,
  avgDuration: '00:00:00',
  totalAreaKm2: 0,
  avgAreaKm2: 0,
  totalSteps: 0,
  avgSteps: 0,
});

interface RunRow {
  started_at: Date;
  distance_km: number;
  average_speed_kmh: number;
  pace_min_per_km: number;
  duration_seconds: number;
}

interface TerritoryRow {
  captured_at: Date;
  area_m2: number;
}

interface StepRow {
  started_at: Date;
  steps: number;
}

@Injectable()
export class StatsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ─── A. Statistics ────────────────────────────────────────────────────────
  async getStats(
    userId: string,
    dimension: StatsDimension,
    period: StatsPeriod,
  ): Promise<StatsResponseDto> {
    const buckets = StatsService.buildBuckets(period);
    const since = buckets[0].start;

    if (dimension === StatsDimension.Running) {
      const rows: RunRow[] = await this.dataSource.query(
        `SELECT started_at, distance_km, average_speed_kmh, pace_min_per_km, duration_seconds
           FROM game_free_run
          WHERE user_id = $1 AND started_at >= $2`,
        [userId, since],
      );
      return this.runningStats(rows, period, buckets);
    }

    if (dimension === StatsDimension.Territory) {
      const rows: TerritoryRow[] = await this.dataSource.query(
        `SELECT captured_at, area_m2
           FROM game_territory
          WHERE owner_user_id = $1 AND captured_at >= $2`,
        [userId, since],
      );
      return this.territoryStats(rows, period, buckets);
    }

    // Steps (Phase E) — pedometer sessions from game_step_activity.
    const stepRows: StepRow[] = await this.dataSource.query(
      `SELECT started_at, steps
         FROM game_step_activity
        WHERE user_id = $1 AND started_at >= $2`,
      [userId, since],
    );
    return this.stepsStats(stepRows, period, buckets);
  }

  private stepsStats(rows: StepRow[], period: StatsPeriod, buckets: Bucket[]): StatsResponseDto {
    const summary = emptySummary();
    summary.activityCount = rows.length;
    let total = 0;
    for (const r of rows) total += Number(r.steps);
    summary.totalSteps = Math.round(total);
    summary.avgSteps = rows.length > 0 ? Math.round(total / rows.length) : 0;

    const chart = StatsService.fillChart(buckets, rows, (r) => r.started_at, (r) =>
      Number(r.steps),
    );
    return { dimension: StatsDimension.Steps, period, unit: 'steps', summary, chart };
  }

  private runningStats(rows: RunRow[], period: StatsPeriod, buckets: Bucket[]): StatsResponseDto {
    const summary = emptySummary();
    summary.activityCount = rows.length;

    let speedSum = 0;
    let paceSum = 0;
    let paceCount = 0;
    for (const r of rows) {
      summary.totalDistanceKm += Number(r.distance_km);
      summary.totalDurationSeconds += Number(r.duration_seconds);
      speedSum += Number(r.average_speed_kmh);
      if (Number(r.pace_min_per_km) > 0) {
        paceSum += Number(r.pace_min_per_km);
        paceCount++;
      }
    }
    if (rows.length > 0) {
      summary.avgDistanceKm = round(summary.totalDistanceKm / rows.length, 2);
      summary.avgSpeedKmh = round(speedSum / rows.length, 2);
      summary.avgDuration = formatDuration((summary.totalDurationSeconds / rows.length) * 1000);
    }
    summary.avgPaceMinPerKm = paceCount > 0 ? round(paceSum / paceCount, 2) : 0;
    summary.totalDistanceKm = round(summary.totalDistanceKm, 2);

    const chart = StatsService.fillChart(buckets, rows, (r) => r.started_at, (r) =>
      Number(r.distance_km),
    );
    return { dimension: StatsDimension.Running, period, unit: 'km', summary, chart };
  }

  private territoryStats(
    rows: TerritoryRow[],
    period: StatsPeriod,
    buckets: Bucket[],
  ): StatsResponseDto {
    const summary = emptySummary();
    summary.activityCount = rows.length;
    let totalM2 = 0;
    for (const r of rows) totalM2 += Number(r.area_m2);
    summary.totalAreaKm2 = round(totalM2 / 1_000_000, 4);
    summary.avgAreaKm2 = rows.length > 0 ? round(totalM2 / 1_000_000 / rows.length, 4) : 0;

    const chart = StatsService.fillChart(buckets, rows, (r) => r.captured_at, (r) =>
      Number(r.area_m2) / 1_000_000,
    );
    return { dimension: StatsDimension.Territory, period, unit: 'km²', summary, chart };
  }

  // ─── B. Personal Bests ────────────────────────────────────────────────────
  async getPersonalBests(userId: string): Promise<PersonalBestsResponseDto> {
    const [fastest] = await this.dataSource.query(
      `SELECT average_speed_kmh AS v, started_at AS d
         FROM game_free_run
        WHERE user_id = $1 AND average_speed_kmh > 0
        ORDER BY average_speed_kmh DESC LIMIT 1`,
      [userId],
    );
    const [longest] = await this.dataSource.query(
      `SELECT distance_km AS v, started_at AS d
         FROM game_free_run
        WHERE user_id = $1 AND distance_km > 0
        ORDER BY distance_km DESC LIMIT 1`,
      [userId],
    );
    const [largest] = await this.dataSource.query(
      `SELECT area_m2 AS v, captured_at AS d
         FROM game_territory
        WHERE owner_user_id = $1
        ORDER BY area_m2 DESC LIMIT 1`,
      [userId],
    );

    const best = (
      row: { v: number; d: Date } | undefined,
      transform: (v: number) => number,
    ): PersonalBestDto | null =>
      row ? { value: transform(Number(row.v)), date: formatDate(new Date(row.d)) } : null;

    return {
      fastestSpeedKmh: best(fastest, (v) => round(v, 2)),
      longestDistanceKm: best(longest, (v) => round(v, 2)),
      largestTerritoryKm2: best(largest, (v) => round(v / 1_000_000, 4)),
    };
  }

  // ─── C. Achievements ──────────────────────────────────────────────────────
  async getAchievements(userId: string): Promise<AchievementsResponseDto> {
    const [distRow] = await this.dataSource.query(
      `SELECT COALESCE(SUM(distance_km), 0) AS total FROM game_free_run WHERE user_id = $1`,
      [userId],
    );
    const [terrRow] = await this.dataSource.query(
      `SELECT COALESCE(SUM(area_m2), 0) / 1000000.0 AS total
         FROM game_territory WHERE owner_user_id = $1`,
      [userId],
    );
    const totalDistanceKm = Number(distRow?.total ?? 0);
    const totalTerritoryKm2 = Number(terrRow?.total ?? 0);

    const unlocks = await this.loadUnlocks(userId);

    // Lazy unlock: persist any badge whose threshold is now crossed but isn't yet recorded.
    const newlyUnlocked: string[] = [];
    for (const def of ALL_ACHIEVEMENTS) {
      const total = def.type === 'distance' ? totalDistanceKm : totalTerritoryKm2;
      if (total >= def.threshold && !unlocks.has(def.code)) newlyUnlocked.push(def.code);
    }
    if (newlyUnlocked.length > 0) {
      const now = await this.insertUnlocks(userId, newlyUnlocked);
      for (const code of newlyUnlocked) unlocks.set(code, now);
    }

    const toDto = (def: AchievementDef): AchievementDto => {
      const total = def.type === 'distance' ? totalDistanceKm : totalTerritoryKm2;
      const unlockedAt = unlocks.get(def.code) ?? null;
      const current = round(Math.min(total, def.threshold), def.unit === 'km²' ? 4 : 2);
      const displayTotal = round(total, def.unit === 'km²' ? 4 : 2);
      return {
        code: def.code,
        type: def.type,
        title: def.title,
        threshold: def.threshold,
        unit: def.unit,
        current,
        progress: round(Math.min(total / def.threshold, 1), 4),
        progressText: `${displayTotal}/${def.threshold}`,
        isUnlocked: unlockedAt != null,
        unlockedAt: unlockedAt ? formatDate(new Date(unlockedAt)) : null,
      };
    };

    return {
      distance: DISTANCE_ACHIEVEMENTS.map(toDto),
      territory: TERRITORY_ACHIEVEMENTS.map(toDto),
    };
  }

  private async loadUnlocks(userId: string): Promise<Map<string, Date>> {
    const rows: Array<{ achievement_code: string; unlocked_at: Date }> =
      await this.dataSource.query(
        `SELECT achievement_code, unlocked_at FROM game_user_achievement WHERE user_id = $1`,
        [userId],
      );
    const map = new Map<string, Date>();
    for (const r of rows) map.set(r.achievement_code, r.unlocked_at);
    return map;
  }

  /** Insert new unlock rows at one shared timestamp; ON CONFLICT keeps the first unlock. */
  private async insertUnlocks(userId: string, codes: string[]): Promise<Date> {
    const values = codes.map((_, i) => `($1, $${i + 2}, now())`).join(', ');
    const inserted: Array<{ unlocked_at: Date }> = await this.dataSource.query(
      `INSERT INTO game_user_achievement (user_id, achievement_code, unlocked_at)
       VALUES ${values}
       ON CONFLICT (user_id, achievement_code) DO NOTHING
       RETURNING unlocked_at`,
      [userId, ...codes],
    );
    return inserted[0]?.unlocked_at ?? new Date();
  }

  // ─── Chart bucketing ──────────────────────────────────────────────────────
  /** Build the (empty) bucket axis for a period: 7 days / 30 days / 12 months, ending today. */
  private static buildBuckets(period: StatsPeriod): Bucket[] {
    const now = new Date();
    const buckets: Bucket[] = [];

    if (period === StatsPeriod.Yearly) {
      // 12 monthly buckets ending this month (UTC).
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      for (let i = 11; i >= 0; i--) {
        const start = new Date(Date.UTC(y, m - i, 1));
        const end = new Date(Date.UTC(y, m - i + 1, 1));
        const label = `${pad(start.getUTCMonth() + 1)}.${start.getUTCFullYear()}`;
        buckets.push({ start, end, label });
      }
      return buckets;
    }

    const days = period === StatsPeriod.Weekly ? 7 : 30;
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(today);
      start.setUTCDate(start.getUTCDate() - i);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      const label = `${pad(start.getUTCDate())}.${pad(start.getUTCMonth() + 1)}`;
      buckets.push({ start, end, label });
    }
    return buckets;
  }

  /** Sum each row's value into the bucket whose [start,end) contains its date. */
  private static fillChart<T>(
    buckets: Bucket[],
    rows: T[],
    dateOf: (r: T) => Date,
    valueOf: (r: T) => number,
  ): Array<{ label: string; value: number }> {
    const totals = new Array(buckets.length).fill(0);
    for (const r of rows) {
      const t = new Date(dateOf(r)).getTime();
      for (let i = 0; i < buckets.length; i++) {
        if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) {
          totals[i] += valueOf(r);
          break;
        }
      }
    }
    return buckets.map((b, i) => ({ label: b.label, value: round(totals[i], 4) }));
  }
}

interface Bucket {
  start: Date;
  end: Date;
  label: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');
