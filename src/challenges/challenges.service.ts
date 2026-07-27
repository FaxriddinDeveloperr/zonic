// Challenges / Duels (Phase I). A challenge targets a friend by ZONIC-ID with a goal type, start
// time and a Tanga bet. Lifecycle: pending → accepted/declined; an accepted challenge whose start
// time has passed is reported as 'active' (live result tracking + bet settlement is a follow-up —
// the TZ models the live duel on the client). No fund movement happens here yet.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatIso, parseFlexibleDateTime } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { FriendsService } from '../friends/friends.service';
import { NotificationsService } from '../notifications/notifications.service';
import { weekMonday } from '../common/helpers/week';
import {
  ChallengeDto,
  ChallengeGoal,
  ChallengeListDto,
  ChallengeOkDto,
  ChallengeProgressDto,
} from './dto/challenge.dto';

interface ChallengeRow {
  id: string;
  challenger_id: string;
  challenger_name: string;
  challenger_zid: number;
  opponent_id: string;
  opponent_name: string;
  opponent_zid: number;
  goal_type: string;
  start_at: Date;
  end_at: Date;
  bet: string;
  status: string;
  created_at: Date;
  winner_user_id: string | null;
}

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly friends: FriendsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Challenges are FREE to create/accept (nobody stakes anything). When the duel is settled the
   * SYSTEM pays the winner this fixed prize; a tie pays nobody.
   */
  static readonly WINNER_PRIZE = 200;
  static readonly DEFAULT_DURATION_HOURS = 24;

  async create(
    userId: string,
    opponentZonicId: number,
    goalType: ChallengeGoal,
    startAt: string,
    durationHours?: number,
  ): Promise<ChallengeDto> {
    const opponent = await this.friends.search(opponentZonicId); // 404 if missing
    if (opponent.userId === userId) throw badRequest(['You cannot challenge yourself.']);
    // A valid Challenge Ticket (from the Market) is required. Having one also lets you challenge
    // NON-friends — the ticket replaces the old "friends only" rule.
    const ticket = await this.resolveTicket(userId);
    if (!ticket) {
      throw new BadRequestException({
        message: "Bellashuv yuborish uchun Do'kondan Chorlov kartasini sotib olishingiz kerak",
        status: 400,
      });
    }
    const start = parseFlexibleDateTime(startAt);
    if (!start) throw badRequest(['startAt is not a valid date.']);
    const hours = durationHours ?? ChallengesService.DEFAULT_DURATION_HOURS;
    const end = new Date(start.getTime() + hours * 3600 * 1000);

    // One active duel per pair: block a new invite while a pending/accepted challenge exists
    // between the two (either direction). Declined/finished ones don't block — re-invite is allowed.
    const [active] = await this.dataSource.query(
      `SELECT id FROM game_challenge
        WHERE status IN ('pending', 'accepted')
          AND ((challenger_id = $1 AND opponent_id = $2)
            OR (challenger_id = $2 AND opponent_id = $1))
        LIMIT 1`,
      [userId, opponent.userId],
    );
    if (active) {
      throw badRequest(['Bu foydalanuvchi bilan faol bellashuv allaqachon mavjud.']);
    }

    // bet column now records the system prize for display (nothing is taken from players).
    const [ins]: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO game_challenge (challenger_id, opponent_id, goal_type, start_at, end_at, bet, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id::text`,
      [userId, opponent.userId, goalType, start, end, ChallengesService.WINNER_PRIZE],
    );
    // Consume a single-use ticket now that the challenge is created (time-based ones stay).
    if (ticket.consumePurchaseId) {
      await this.dataSource.query(
        `UPDATE market_purchase SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
        [ticket.consumePurchaseId],
      );
    }

    const dto = await this.getOne(ins.id, userId);
    // Notify (+push) the opponent that they've been challenged.
    await this.notifications.create(
      dto.opponent.userId,
      'challenge_invite',
      `${dto.challenger.username} sizni bellashuvga chorladi`,
      null,
      {
        challengeId: dto.id,
        goalType: dto.goalType,
        fromZonicId: dto.challenger.zonicId,
        fromUsername: dto.challenger.username,
      },
    );
    return dto;
  }

  async respond(userId: string, challengeId: string, accept: boolean): Promise<ChallengeOkDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query(
        `SELECT challenger_id::text, opponent_id::text, bet, status
           FROM game_challenge WHERE id = $1 FOR UPDATE`,
        [challengeId],
      );
      if (!row || row.opponent_id !== userId || row.status !== 'pending') {
        throw badRequest(['No pending challenge to respond to.']);
      }
      const status = accept ? 'accepted' : 'declined';
      // No escrow — challenges are free; the system pays the winner at finish.
      await manager.query(
        `UPDATE game_challenge SET status = $2, responded_at = now() WHERE id = $1`,
        [challengeId, status],
      );
      return { challengerId: row.challenger_id as string, status };
    });

    // Notify (+push) the challenger that their invite was accepted/declined.
    const [me] = await this.dataSource.query(
      `SELECT username, zonic_id FROM sys_user WHERE id = $1`,
      [userId],
    );
    const who = me?.username ?? 'Foydalanuvchi';
    await this.notifications.create(
      result.challengerId,
      result.status === 'accepted' ? 'challenge_accepted' : 'challenge_declined',
      `${who} bellashuvni ${result.status === 'accepted' ? 'qabul qildi' : 'rad etdi'}`,
      null,
      { challengeId, fromZonicId: me?.zonic_id ?? null, fromUsername: me?.username ?? null },
    );
    return { ok: true, status: result.status };
  }

  /**
   * Settle an accepted duel: measure each side's progress in the goal metric from start_at to now;
   * the SYSTEM pays the winner WINNER_PRIZE (a tie pays nobody — nothing was staked). Callable by
   * either participant once the start time has passed. Idempotent (re-finishing returns the result).
   */
  async finish(userId: string, challengeId: string): Promise<ChallengeDto> {
    const settled = await this.dataSource.transaction(async (manager) => {
      const [c] = await manager.query(
        `SELECT id::text, challenger_id::text, opponent_id::text, goal_type, start_at, end_at, bet, status
           FROM game_challenge WHERE id = $1 FOR UPDATE`,
        [challengeId],
      );
      if (!c) throw badRequest(['Challenge not found.']);
      if (c.challenger_id !== userId && c.opponent_id !== userId) {
        throw badRequest(['You are not part of this challenge.']);
      }
      if (c.status === 'finished') return null; // idempotent — already settled, don't re-notify
      if (c.status !== 'accepted') throw badRequest(['Challenge is not active.']);
      // Fair window: settle only AFTER the end time, measuring [start_at, end_at] — never "up to now".
      if (new Date(c.end_at).getTime() > Date.now()) {
        throw badRequest(['Bellashuv hali tugamadi — belgilangan vaqt o‘tishini kuting.']);
      }
      return ChallengesService.settle(manager, c);
    });
    if (settled) await this.notifyFinished(challengeId, settled);
    return this.getOne(challengeId, userId);
  }

  /**
   * Auto-settle every accepted challenge whose end time has passed — so a duel always resolves even
   * if neither player calls Finish. Runs every minute.
   */
  @Cron('*/1 * * * *')
  async settleDue(): Promise<void> {
    const due: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id::text FROM game_challenge WHERE status = 'accepted' AND end_at <= now()`,
    );
    for (const { id } of due) {
      try {
        const settled = await this.dataSource.transaction(async (manager) => {
          const [c] = await manager.query(
            `SELECT id::text, challenger_id::text, opponent_id::text, goal_type, start_at, end_at, status
               FROM game_challenge WHERE id = $1 FOR UPDATE`,
            [id],
          );
          if (!c || c.status !== 'accepted' || new Date(c.end_at).getTime() > Date.now()) return null;
          return ChallengesService.settle(manager, c);
        });
        if (settled) await this.notifyFinished(id, settled);
      } catch (e) {
        this.logger.error(`Auto-settle failed for challenge ${id}: ${(e as Error).message}`);
      }
    }
  }

  /** Measure both sides over [start_at, end_at], pay the winner, mark finished. */
  private static async settle(
    manager: { query: (sql: string, params?: unknown[]) => Promise<any> },
    c: { id: string; challenger_id: string; opponent_id: string; goal_type: string; start_at: Date; end_at: Date },
  ): Promise<{ challengerId: string; opponentId: string; winner: string | null }> {
    const start = new Date(c.start_at);
    const end = new Date(c.end_at);
    const a = await ChallengesService.progress(manager, c.challenger_id, c.goal_type, start, end);
    const b = await ChallengesService.progress(manager, c.opponent_id, c.goal_type, start, end);

    let winner: string | null = null;
    if (a > b) winner = c.challenger_id;
    else if (b > a) winner = c.opponent_id;

    if (winner) {
      await ChallengesService.creditTanga(manager, winner, ChallengesService.WINNER_PRIZE);
    }
    await manager.query(
      `UPDATE game_challenge SET status = 'finished', winner_user_id = $2, finished_at = now() WHERE id = $1`,
      [c.id, winner],
    );
    return { challengerId: c.challenger_id, opponentId: c.opponent_id, winner };
  }

  private async notifyFinished(
    challengeId: string,
    settled: { challengerId: string; opponentId: string; winner: string | null },
  ): Promise<void> {
    const dto = await this.getOne(challengeId, settled.challengerId);
    const winnerName = settled.winner
      ? settled.winner === dto.challenger.userId
        ? dto.challenger.username
        : dto.opponent.username
      : null;
    const body = winnerName ? `G'olib: ${winnerName}` : 'Durang';
    for (const uid of [settled.challengerId, settled.opponentId]) {
      await this.notifications.create(uid, 'challenge_finished', 'Bellashuv yakunlandi', body, {
        challengeId: dto.id,
        winnerUserId: settled.winner,
        prize: settled.winner ? ChallengesService.WINNER_PRIZE : 0,
      });
    }
  }

  private static async creditTanga(
    manager: { query: (sql: string, params?: unknown[]) => Promise<any> },
    userId: string,
    amount: number,
  ): Promise<void> {
    // Coins are weekly: a balance from an earlier week is burned before the prize lands.
    const monday = weekMonday();
    await manager.query(
      `INSERT INTO game_user_wallet (user_id, tanga, tanga_week) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET tanga = (CASE WHEN game_user_wallet.tanga_week = $3 THEN game_user_wallet.tanga ELSE 0 END) + $2,
             tanga_week = $3,
             updated_at = now()`,
      [userId, amount, monday],
    );
  }

  /** Sum the goal metric for a user over [start, end]: running=km, steps=count, territory=m². */
  private static async progress(
    manager: { query: (sql: string, params?: unknown[]) => Promise<any> },
    userId: string,
    goalType: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    if (goalType === 'steps') {
      const [r] = await manager.query(
        `SELECT COALESCE(SUM(steps),0) AS v FROM game_step_activity
          WHERE user_id = $1 AND started_at >= $2 AND started_at <= $3`,
        [userId, start, end],
      );
      return Number(r.v);
    }
    if (goalType === 'territory') {
      const [r] = await manager.query(
        `SELECT COALESCE(SUM(area_m2),0) AS v FROM game_territory
          WHERE owner_user_id = $1 AND captured_at >= $2 AND captured_at <= $3`,
        [userId, start, end],
      );
      return Number(r.v);
    }
    // running
    const [r] = await manager.query(
      `SELECT COALESCE(SUM(distance_km),0) AS v FROM game_free_run
        WHERE user_id = $1 AND started_at >= $2 AND started_at <= $3`,
      [userId, start, end],
    );
    return Number(r.v);
  }

  async list(userId: string): Promise<ChallengeListDto> {
    const rows: ChallengeRow[] = await this.dataSource.query(
      `${ChallengesService.SELECT}
        WHERE c.challenger_id = $1 OR c.opponent_id = $1
        ORDER BY c.created_at DESC`,
      [userId],
    );
    return { challenges: rows.map((r) => ChallengesService.toDto(r, userId)) };
  }

  /** Live scoreboard for a challenge: each side's progress so far + who's ahead + time remaining. */
  async getProgress(userId: string, challengeId: string): Promise<ChallengeProgressDto> {
    const [row] = await this.dataSource.query(
      `${ChallengesService.SELECT} WHERE c.id = $1`,
      [challengeId],
    );
    if (!row) throw badRequest(['Challenge not found.']);
    if (row.challenger_id !== userId && row.opponent_id !== userId) {
      throw badRequest(['You are not part of this challenge.']);
    }
    const dto = ChallengesService.toDto(row, userId);

    // Measure live: from start up to now, but never past the window end.
    const start = new Date(row.start_at);
    const end = new Date(row.end_at);
    const now = new Date();
    const measureEnd = now < end ? now : end;
    const startedYet = now >= start;

    const rawA = startedYet
      ? await ChallengesService.progress(this.dataSource, row.challenger_id, row.goal_type, start, measureEnd)
      : 0;
    const rawB = startedYet
      ? await ChallengesService.progress(this.dataSource, row.opponent_id, row.goal_type, start, measureEnd)
      : 0;

    const unit = row.goal_type === 'territory' ? 'km²' : row.goal_type === 'running' ? 'km' : 'steps';
    const toVal = (v: number): number =>
      row.goal_type === 'territory'
        ? Math.round((v / 1_000_000) * 10000) / 10000
        : row.goal_type === 'running'
          ? Math.round(v * 100) / 100
          : Math.round(v);

    let leaderUserId: string | null = null;
    if (rawA > rawB) leaderUserId = row.challenger_id;
    else if (rawB > rawA) leaderUserId = row.opponent_id;

    const challengerSide = { ...dto.challenger, value: toVal(rawA) };
    const opponentSide = { ...dto.opponent, value: toVal(rawB) };
    const meIsChallenger = row.challenger_id === userId;

    return {
      challengeId,
      goalType: row.goal_type,
      unit,
      status: dto.status,
      startAt: dto.startAt,
      endAt: dto.endAt,
      secondsRemaining: Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000)),
      me: meIsChallenger ? challengerSide : opponentSide,
      opponent: meIsChallenger ? opponentSide : challengerSide,
      leaderUserId,
    };
  }

  /**
   * Find a usable Challenge Ticket. Prefers a valid time-based/permanent ticket (unlimited use, no
   * consumption); falls back to a single-use ticket (which the caller then consumes). Returns null
   * when the user has no valid ticket → the caller returns 400.
   */
  private async resolveTicket(userId: string): Promise<{ consumePurchaseId: string | null } | null> {
    const rows: Array<{ purchase_id: string; duration: string; expires_at: Date | null }> =
      await this.dataSource.query(
        `SELECT p.id::text AS purchase_id, i.duration,
                CASE i.duration
                  WHEN '1d' THEN p.purchased_at + interval '1 day'
                  WHEN '1m' THEN p.purchased_at + interval '30 days'
                  WHEN '3m' THEN p.purchased_at + interval '90 days'
                  ELSE NULL
                END AS expires_at
           FROM market_purchase p JOIN market_item i ON i.id = p.item_id
          WHERE p.user_id = $1 AND p.consumed_at IS NULL AND i.category = 'challenge'`,
        [userId],
      );
    const now = Date.now();
    // 1) A still-valid time-based ticket, or a permanent one → use without consuming.
    const unlimited = rows.find(
      (r) =>
        r.duration === 'permanent' ||
        (['1d', '1m', '3m'].includes(r.duration) &&
          r.expires_at != null &&
          new Date(r.expires_at).getTime() > now),
    );
    if (unlimited) return { consumePurchaseId: null };
    // 2) A single-use ticket → will be consumed after the challenge is created.
    const single = rows.find((r) => r.duration === 'single');
    if (single) return { consumePurchaseId: single.purchase_id };
    // 3) No valid ticket.
    return null;
  }

  private async getOne(id: string, userId: string): Promise<ChallengeDto> {
    const [row] = await this.dataSource.query(`${ChallengesService.SELECT} WHERE c.id = $1`, [id]);
    return ChallengesService.toDto(row, userId);
  }

  private static readonly SELECT = `
    SELECT c.id::text, c.goal_type, c.start_at, c.end_at, c.bet, c.status, c.created_at,
           c.winner_user_id::text AS winner_user_id,
           ch.id::text AS challenger_id, ch.username AS challenger_name, ch.zonic_id AS challenger_zid,
           op.id::text AS opponent_id,   op.username AS opponent_name,   op.zonic_id AS opponent_zid
      FROM game_challenge c
      JOIN sys_user ch ON ch.id = c.challenger_id
      JOIN sys_user op ON op.id = c.opponent_id`;

  private static toDto(r: ChallengeRow, userId: string): ChallengeDto {
    // Accepted + start time passed → 'active' for the UI (until auto/manual settlement flips it to
    // 'finished'); everything else is the stored status.
    let status = r.status;
    if (status === 'accepted' && new Date(r.start_at).getTime() <= Date.now()) status = 'active';
    return {
      id: r.id,
      challenger: { userId: r.challenger_id, username: r.challenger_name, zonicId: r.challenger_zid },
      opponent: { userId: r.opponent_id, username: r.opponent_name, zonicId: r.opponent_zid },
      goalType: r.goal_type,
      startAt: formatIso(new Date(r.start_at)),
      endAt: formatIso(new Date(r.end_at)),
      bet: Number(r.bet),
      status,
      direction: r.challenger_id === userId ? 'outgoing' : 'incoming',
      winnerUserId: r.winner_user_id,
      createdAt: formatIso(new Date(r.created_at)),
    };
  }
}
