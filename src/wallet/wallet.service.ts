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

  /**
   * Credit Tanga + XP for an activity, immediately (automatic earning). Rates from config:
   * 1 km run / 1000 steps / 1 territory capture each ≈ tangaPerKm etc. Called on save/capture.
   */
  async creditForActivity(
    userId: string,
    a: { km?: number; steps?: number; hexagons?: number },
  ): Promise<{ tangaEarned: number; xpEarned: number }> {
    const e = this.econ;
    const km = a.km ?? 0;
    const steps = a.steps ?? 0;
    const hex = a.hexagons ?? 0;
    const tangaEarned = Math.round(
      km * e.tangaPerKm + (steps / 1000) * e.tangaPer1000Steps + hex * e.tangaPerHexagon,
    );
    const xpEarned = Math.round(
      km * e.xpPerKm + (steps / 1000) * e.xpPer1000Steps + hex * e.xpPerHexagon,
    );
    await this.credit(userId, tangaEarned, xpEarned);
    return { tangaEarned, xpEarned };
  }

  /** Add Tanga (persistent) + XP (today, expiry-aware) to the wallet. */
  async credit(userId: string, tanga: number, xp: number): Promise<void> {
    if (tanga <= 0 && xp <= 0) return;
    const row = await this.loadOrCreate(userId);
    const today = WalletService.utcDateStr(new Date());
    const { xp: currentXp } = this.applyXpExpiry(row, await this.retentionHours(userId));
    const newXp = (row.xp_date === today ? currentXp : 0) + Math.max(0, Math.round(xp));
    const newTanga = Number(row.tanga) + Math.max(0, Math.round(tanga));
    await this.dataSource.query(
      `UPDATE game_user_wallet SET tanga = $2, xp = $3, xp_date = $4, updated_at = now()
        WHERE user_id = $1`,
      [userId, newTanga, newXp, today],
    );
  }

  /**
   * DEPRECATED — earning is now automatic (credited on each activity save/capture). Kept for
   * backward compatibility: returns the current balance with 0 newly earned.
   */
  async claimDailyReward(userId: string): Promise<DailyRewardDto> {
    const wallet = await this.getWallet(userId);
    return { km: 0, steps: 0, hexagons: 0, tangaEarned: 0, xpEarned: 0, tanga: wallet.tanga, xp: wallet.xp };
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
