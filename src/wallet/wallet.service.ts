// Wallet & daily reward (Phase J). Two currencies:
//  • Tanga — coins earned from activity, spent in the Market. They live for ONE WEEK: everything
//    unspent is burned at Monday 00:00 local (Tashkent). tanga_week records the week a balance
//    belongs to; a mismatch with the current week means it has expired.
//  • XP — expiring rating currency; reset once its retention window (24h free) rolls over.
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EconomyConfig } from '../config/configuration';
import { SubscriptionService } from '../subscription/subscription.service';
import { NotificationsService } from '../notifications/notifications.service';
import { weekEndsAt, weekMonday } from '../common/helpers/week';
import { WalletDto, DailyRewardDto } from './dto/wallet.dto';

interface WalletRow {
  tanga: string;
  xp: string;
  xp_date: string | null; // 'YYYY-MM-DD'
  tanga_week: string | null; // 'YYYY-MM-DD' — the local Monday this balance belongs to
  last_reward_at: Date | null;
}

@Injectable()
export class WalletService {
  private readonly econ: EconomyConfig;
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscription: SubscriptionService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.econ = config.get<EconomyConfig>('economy')!;
  }

  /** XP retention window in hours for this user — premium tiers keep XP longer (48h vs 24h). */
  private async retentionHours(userId: string): Promise<number> {
    const sub = await this.subscription.getMe(userId);
    return sub.tier === 'free' ? this.econ.xpRetentionHours : this.econ.xpRetentionHoursPremium;
  }

  /** Read the wallet, lazily burning last week's Tanga and XP past its retention window. */
  async getWallet(userId: string): Promise<WalletDto> {
    const row = await this.loadOrCreate(userId);
    const { xp, expiresAt } = this.applyXpExpiry(row, await this.retentionHours(userId));

    // Tanga from an earlier week is gone.
    const monday = weekMonday();
    const tanga = row.tanga_week === monday ? Number(row.tanga) : 0;

    if (xp !== Number(row.xp) || tanga !== Number(row.tanga)) {
      await this.dataSource.query(
        `UPDATE game_user_wallet SET xp = $2, tanga = $3, tanga_week = $4, updated_at = now()
          WHERE user_id = $1`,
        [userId, xp, tanga, monday],
      );
    }
    return {
      tanga,
      tangaExpiresAt: weekEndsAt().toISOString(),
      xp,
      xpExpiresAt: xp > 0 ? expiresAt : null,
    };
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
    // Coins from a previous week are burned before this credit lands.
    const monday = weekMonday();
    const base = row.tanga_week === monday ? Number(row.tanga) : 0;
    const newTanga = base + Math.max(0, Math.round(tanga));
    await this.dataSource.query(
      `UPDATE game_user_wallet
          SET tanga = $2, tanga_week = $5, xp = $3, xp_date = $4, updated_at = now()
        WHERE user_id = $1`,
      [userId, newTanga, newXp, today, monday],
    );
  }

  /**
   * Burn every wallet still holding a previous week's coins. Runs often so the DB is truthful right
   * after the Monday 00:00 (Tashkent) rollover, even for users who don't open the app.
   */
  @Cron('*/10 * * * *')
  async burnExpiredTanga(): Promise<void> {
    const monday = weekMonday();
    const res = await this.dataSource.query(
      `UPDATE game_user_wallet SET tanga = 0, tanga_week = $1, updated_at = now()
        WHERE tanga_week IS DISTINCT FROM $1 AND tanga > 0`,
      [monday],
    );
    const burned = Array.isArray(res) ? (res[1] ?? 0) : 0;
    if (burned) this.logger.log(`Weekly Tanga burn: ${burned} wallet(s) reset for week ${monday}`);
  }

  /**
   * Sunday 20:00 Tashkent — warn everyone still holding coins that they burn on Monday 00:00.
   */
  @Cron('0 20 * * 0', { timeZone: 'Asia/Tashkent' })
  async warnTangaExpiry(): Promise<void> {
    const monday = weekMonday();
    const rows: Array<{ user_id: string; tanga: string }> = await this.dataSource.query(
      `SELECT user_id::text, tanga FROM game_user_wallet WHERE tanga_week = $1 AND tanga > 0`,
      [monday],
    );
    for (const r of rows) {
      await this.notifications.create(
        r.user_id,
        'tanga_expiring',
        `${r.tanga} tanga ertaga yonadi!`,
        'Dushanba 00:00 da ishlatilmagan tangalar 0 ga tushadi — Marketda sarflang.',
        { tanga: Number(r.tanga), expiresAt: weekEndsAt().toISOString() },
      );
    }
    if (rows.length) this.logger.log(`Tanga expiry warning sent to ${rows.length} user(s)`);
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
      `SELECT tanga, xp, to_char(xp_date, 'YYYY-MM-DD') AS xp_date,
              to_char(tanga_week, 'YYYY-MM-DD') AS tanga_week, last_reward_at
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
