// AI Coach (Phase O) — heart-rate-zone analysis + real-time coaching cues (the AI Coach doc).
// This is the deterministic engine: HR zones from the user's age (maxHR = 220 − age) and rule-based
// feedback tuned by the user's level (beginner = safety-first, professional = performance). It is a
// Gold+ feature. A conversational LLM layer (Claude) can wrap this later for free-form Q&A —
// hook point noted in coachReply(); the zone math and safety rules below need no model.
import { ForbiddenException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { badRequest } from '../common/validation-problem';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  CoachFeedbackDto,
  CoachFeedbackRequestDto,
  HeartZoneDto,
  ZonesResponseDto,
} from './dto/coach.dto';

// Zone lower bounds as a fraction of max HR (Z1..Z5).
const ZONE_DEFS: Array<{ zone: number; name: string; lo: number; hi: number }> = [
  { zone: 1, name: 'Recovery', lo: 0.5, hi: 0.6 },
  { zone: 2, name: 'Aerobic base', lo: 0.6, hi: 0.7 },
  { zone: 3, name: 'Aerobic', lo: 0.7, hi: 0.8 },
  { zone: 4, name: 'Threshold', lo: 0.8, hi: 0.9 },
  { zone: 5, name: 'Maximum', lo: 0.9, hi: 1.0 },
];

@Injectable()
export class CoachService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscription: SubscriptionService,
  ) {}

  async zones(userId: string): Promise<ZonesResponseDto> {
    const { age, maxHr } = await this.requireCoach(userId);
    const zones: HeartZoneDto[] = ZONE_DEFS.map((z) => ({
      zone: z.zone,
      name: z.name,
      minBpm: Math.round(maxHr * z.lo),
      maxBpm: Math.round(maxHr * z.hi),
    }));
    return { age, maxHr, zones };
  }

  async feedback(userId: string, dto: CoachFeedbackRequestDto): Promise<CoachFeedbackDto> {
    const { age, maxHr, level } = await this.requireCoach(userId);
    void age;
    const pct = dto.bpm / maxHr;
    const def = ZONE_DEFS.find((z) => pct < z.hi) ?? ZONE_DEFS[ZONE_DEFS.length - 1];
    const beginner = level !== 'professional';

    let level_: 'ok' | 'push' | 'ease' | 'warning' = 'ok';
    let message: string;
    switch (def.zone) {
      case 5:
        level_ = 'warning';
        message = beginner
          ? "Diqqat! Yurak urishi kritik darajaga yaqin. Tempni pasaytiring va chuqur nafas oling."
          : "Maksimal zonadasiz — bu tempni faqat qisqa vaqt ushlang, keyin Z3 ga tushing.";
        break;
      case 4:
        level_ = beginner ? 'ease' : 'ok';
        message = beginner
          ? "Bo'sag'a zonasidasiz. Biroz sekinlashing, nafasni bir maromga keltiring."
          : "Bo'sag'a zonasi — chidamlilik uchun yaxshi, lekin holatingizni kuzating.";
        break;
      case 3:
        level_ = 'push';
        message = "Aerob zonadasiz, samaradorligingiz yuqori. Xohlasangiz tempni biroz oshiring.";
        break;
      case 2:
        level_ = 'ok';
        message = "Qulay aerob bazadasiz — chidamlilikni oshirish uchun ideal temp.";
        break;
      default:
        level_ = 'push';
        message = "Tiklanish/qizish zonasi. Isib bo'lgach tempni biroz oshirsangiz bo'ladi.";
    }

    const advice: string[] = [];
    if ((dto.durationSeconds ?? 0) >= 40 * 60) {
      advice.push("40 daqiqadan oshdingiz — 150–200 ml suv iching (gidratsiya).");
    }
    if (dto.cadence != null && dto.cadence > 0 && dto.cadence < 160) {
      advice.push("Qadam chastotasi past — tizzani asrash uchun tez-tez, kichik qadam tashlang.");
    }

    return {
      zone: def.zone,
      zoneName: def.name,
      bpm: dto.bpm,
      maxHr,
      percentOfMax: Math.round(pct * 100),
      level: level_,
      message,
      advice,
    };
  }

  // Hook for a future conversational coach (e.g. Claude claude-opus-4-8): feed the user's recent
  // stats + this zone analysis as context and return the model's reply. Not enabled (needs an API
  // key + the @anthropic-ai/sdk); the deterministic engine above covers the core coaching.

  /** Gate on Gold+ (aiCoach) and load the age needed for HR math. */
  private async requireCoach(
    userId: string,
  ): Promise<{ age: number; maxHr: number; level: string | null }> {
    const sub = await this.subscription.getMe(userId);
    if (!sub.features.aiCoach) {
      throw new ForbiddenException('AI Coach is a Gold+ feature.');
    }
    const [u] = await this.dataSource.query(
      `SELECT age, level FROM sys_user WHERE id = $1`,
      [userId],
    );
    if (!u || u.age == null) {
      throw badRequest(['Set your age in the profile to use the AI Coach.']);
    }
    return { age: u.age, maxHr: 220 - u.age, level: u.level };
  }
}
