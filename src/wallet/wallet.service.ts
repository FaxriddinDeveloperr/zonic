// Wallet & daily reward (Phase J). Two currencies:
//  • Tanga — persistent coin balance, only spent in the Market.
//  • XP — expiring rating currency; reset once its retention window (24h free) rolls over.
// Earn-rates come from config. The daily reward converts activity since the last claim into both
// currencies. Reads existing activity tables only — no run/free-run/territory write path changes.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EconomyConfig } from '../config/configuration';
import { SubscriptionService } from '../subscription/subscription.service';
import { WalletDto, DailyRewardDto } from './dto/wallet.dto';

interface WalletRow {
  tanga: string;
  xp: string;
  xp_date: string | null; // 'YYYY-MM-DD'
  last_reward_at: Date | null;
}

@Injectable()
export class WalletService {
  private readonly econ: EconomyConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscription: SubscriptionService,
    config: ConfigService,
  ) {
    this.econ = config.get<EconomyConfig>('economy')!;
  }

  /** XP retention window in hours for this user — premium tiers keep XP longer (48h vs 24h). */
  private async retentionHours(userId: string): Promise<number> {
    const sub = await this.subscription.getMe(userId);
    return sub.tier === 'free' ? this.econ.xpRetentionHours : this.econ.xpRetentionHoursPremium;
  }

  /** Read the wallet, lazily zeroing XP whose retention window has passed. */
  async getWallet(userId: string): Promise<WalletDto> {
    const row = await this.loadOrCreate(userId);
    const { xp, expiresAt } = this.applyXpExpiry(row, await this.retentionHours(userId));
    if (xp !== Number(row.xp)) {
      await this.dataSource.query(
        `UPDATE game_user_wallet SET xp = $2, updated_at = now() WHERE user_id = $1`,
        [userId, xp],
      );
    }
    return { tanga: Number(row.tanga), xp, xpExpiresAt: xp > 0 ? expiresAt : null };
  }

  /** Convert activity since the last claim into Tanga (added) and XP (set/added for today). */
  async claimDailyReward(userId: string): Promise<DailyRewardDto> {
    const row = await this.loadOrCreate(userId);

    // Window: from the last claim (or the last 24h on first ever claim) up to now.
    const now = new Date();
    const windowStart = row.last_reward_at
      ? new Date(row.last_reward_at)
      : new Date(now.getTime() - 24 * 3600 * 1000);

    const [act] = await this.dataSource.query(
      `SELECT
         COALESCE((SELECT SUM(distance_km) FROM game_free_run
                    WHERE user_id = $1 AND started_at > $2 AND started_at <= $3), 0) AS km,
         COALESCE((SELECT SUM(steps) FROM game_step_activity
                    WHERE user_id = $1 AND started_at > $2 AND started_at <= $3), 0) AS steps,
         COALESCE((SELECT COUNT(*) FROM game_territory
                    WHERE owner_user_id = $1 AND captured_at > $2 AND captured_at <= $3), 0) AS hexagons`,
      [userId, windowStart, now],
    );
    const km = Number(act.km);
    const steps = Number(act.steps);
    const hexagons = Number(act.hexagons);

    const e = this.econ;
    const tangaEarned = Math.round(
      km * e.tangaPerKm + (steps / 1000) * e.tangaPer1000Steps + hexagons * e.tangaPerHexagon,
    );
    const xpEarned = Math.round(
      km * e.xpPerKm + (steps / 1000) * e.xpPer1000Steps + hexagons * e.xpPerHexagon,
    );

    // XP accumulates within the same UTC day; a new day replaces the (now-expired) balance.
    const today = WalletService.utcDateStr(now);
    const { xp: currentXp } = this.applyXpExpiry(row, await this.retentionHours(userId));
    const newXp = row.xp_date === today ? currentXp + xpEarned : xpEarned;
    const newTanga = Number(row.tanga) + tangaEarned;

    await this.dataSource.query(
      `UPDATE game_user_wallet
          SET tanga = $2, xp = $3, xp_date = $4, last_reward_at = $5, updated_at = now()
        WHERE user_id = $1`,
      [userId, newTanga, newXp, today, now],
    );

    return { km: Math.round(km * 100) / 100, steps, hexagons, tangaEarned, xpEarned, tanga: newTanga, xp: newXp };
  }

  private async loadOrCreate(userId: string): Promise<WalletRow> {
    await this.dataSource.query(
      `INSERT INTO game_user_wallet (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    const [row] = await this.dataSource.query(
      `SELECT tanga, xp, to_char(xp_date, 'YYYY-MM-DD') AS xp_date, last_reward_at
         FROM game_user_wallet WHERE user_id = $1`,
      [userId],
    );
    return row as WalletRow;
  }

  /** XP is valid only while its earn-date is within the retention window; otherwise it's 0. */
  private applyXpExpiry(row: WalletRow, retentionHours: number): { xp: number; expiresAt: string } {
    const xp = Number(row.xp);
    if (!row.xp_date || xp <= 0) return { xp: 0, expiresAt: '' };

    const retentionDays = Math.max(1, Math.floor(retentionHours / 24));
    const earnDate = new Date(`${row.xp_date}T00:00:00.000Z`);
    const expires = new Date(earnDate.getTime() + retentionDays * 24 * 3600 * 1000);
    const nowMs = Date.now();
    if (nowMs >= expires.getTime()) return { xp: 0, expiresAt: expires.toISOString() };
    return { xp, expiresAt: expires.toISOString() };
  }

  private static utcDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
