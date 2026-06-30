// Subscription tier read + activation (Phase M). An expired paid tier is reported as 'free'.
// activate() is called by the Payment flow once a subscription payment is confirmed.
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatIso } from '../common/helpers/datetime';
import { TIER_PLANS, Tier } from '../common/subscription-tiers';
import { MySubscriptionDto, PlansResponseDto } from './dto/subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  plans(): PlansResponseDto {
    return { plans: Object.values(TIER_PLANS) };
  }

  async getMe(userId: string): Promise<MySubscriptionDto> {
    const [row] = await this.dataSource.query(
      `SELECT tier, expires_at FROM game_subscription WHERE user_id = $1`,
      [userId],
    );
    let tier: Tier = 'free';
    let expiresAt: string | null = null;
    if (row && row.tier !== 'free') {
      const exp = row.expires_at ? new Date(row.expires_at) : null;
      if (!exp || exp.getTime() > Date.now()) {
        tier = row.tier as Tier;
        expiresAt = exp ? formatIso(exp) : null;
      } // else expired → stays 'free'
    }
    return { tier, expiresAt, features: TIER_PLANS[tier].features };
  }

  /** Grant/extend a paid tier by `months` from now (idempotent upsert). Called after payment. */
  async activate(userId: string, tier: Tier, months: number): Promise<void> {
    const expires = new Date(Date.now() + months * 30 * 24 * 3600 * 1000);
    await this.dataSource.query(
      `INSERT INTO game_subscription (user_id, tier, expires_at, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE SET tier = $2, expires_at = $3, updated_at = now()`,
      [userId, tier, expires],
    );
  }
}
