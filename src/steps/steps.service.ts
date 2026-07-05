// Steps / daily pedometer. ONE row per (user, day): both Save and SaveDaily UPSERT the day's
// total, so re-sending the same day never double-counts. `steps` is always the day's cumulative
// total (SET, not added). Feeds the steps stats dimension, activity history and wallet reward.
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StepActivity } from '../entities/step-activity.entity';
import { User } from '../entities/user.entity';
import { formatIso, parseFlexibleDateTime } from '../common/helpers/datetime';
import { caloriePerKm } from '../common/helpers/health';
import { badRequest } from '../common/validation-problem';
import { SaveStepsDto } from './dto/save-steps.dto';
import { SaveDailyStepsDto } from './dto/save-daily-steps.dto';
import {
  StepActivityItemDto,
  StepsHistoryResponseDto,
  TodayStepsDto,
} from './dto/steps-response.dto';

const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

@Injectable()
export class StepsService {
  constructor(
    @InjectRepository(StepActivity) private readonly steps: Repository<StepActivity>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Session-style save — still upserts the day's total (day = startTime's UTC date). */
  async save(userId: string, dto: SaveStepsDto): Promise<{ id: string }> {
    const startedAt = parseFlexibleDateTime(dto.startTime);
    const endedAt = parseFlexibleDateTime(dto.endTime);
    if (!startedAt) throw badRequest(['startTime is not a valid date.']);
    if (!endedAt) throw badRequest(['endTime is not a valid date.']);
    return this.upsertDay(userId, utcDay(startedAt), dto.steps, dto.distanceKm ?? 0, {
      startedAt,
      endedAt,
      durationSeconds: dto.durationSeconds,
    });
  }

  /** Daily pedometer save — send the day's cumulative step total. Repeated calls just update it. */
  async saveDaily(userId: string, dto: SaveDailyStepsDto): Promise<{ id: string }> {
    let day = utcDay(new Date());
    if (dto.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) throw badRequest(['date must be YYYY-MM-DD.']);
      day = dto.date;
    }
    const at = new Date(`${day}T00:00:00.000Z`);
    return this.upsertDay(userId, day, dto.steps, dto.distanceKm ?? 0, {
      startedAt: at,
      endedAt: at,
      durationSeconds: 0,
    });
  }

  /** Today's steps + the user's goal + derived distance/calories/progress. */
  async today(userId: string): Promise<TodayStepsDto> {
    const day = utcDay(new Date());
    const [row] = await this.steps.manager.query(
      `SELECT steps, distance_km FROM game_step_activity WHERE user_id = $1 AND day = $2`,
      [userId, day],
    );
    const user = await this.users.findOne({ where: { id: userId } });
    const goal = user?.stepGoal ?? 10000;
    const steps = Number(row?.steps ?? 0);
    const distanceKm = Number(row?.distance_km ?? 0);
    const kcalPerKm = caloriePerKm(user?.weightKg ?? null, user?.gender ?? null);
    return {
      date: day,
      steps,
      goal,
      progress: goal > 0 ? Math.min(Math.round((steps / goal) * 100) / 100, 1) : 0,
      distanceKm: Math.round(distanceKm * 100) / 100,
      calories: kcalPerKm ? Math.round(kcalPerKm * distanceKm) : 0,
    };
  }

  async getHistory(userId: string, page: number, pageSize: number): Promise<StepsHistoryResponseDto> {
    const rows = await this.steps.find({
      where: { userId },
      order: { day: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: rows.map(StepsService.toItem) };
  }

  private async upsertDay(
    userId: string,
    day: string,
    steps: number,
    distanceKm: number,
    times: { startedAt: Date; endedAt: Date; durationSeconds: number },
  ): Promise<{ id: string }> {
    const [row]: Array<{ id: string }> = await this.steps.manager.query(
      `INSERT INTO game_step_activity (user_id, day, started_at, ended_at, duration_seconds, steps, distance_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, day) DO UPDATE
         SET steps = EXCLUDED.steps, distance_km = EXCLUDED.distance_km,
             duration_seconds = EXCLUDED.duration_seconds,
             started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at
       RETURNING id::text`,
      [userId, day, times.startedAt, times.endedAt, times.durationSeconds, steps, distanceKm],
    );
    return { id: row.id };
  }

  private static toItem(r: StepActivity): StepActivityItemDto {
    return {
      id: r.id,
      startTime: formatIso(new Date(r.startedAt)),
      endTime: formatIso(new Date(r.endedAt)),
      durationSeconds: r.durationSeconds,
      steps: r.steps,
      distanceKm: r.distanceKm,
    };
  }
}
