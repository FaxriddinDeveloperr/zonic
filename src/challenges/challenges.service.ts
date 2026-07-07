// Challenges / Duels (Phase I). A challenge targets a friend by ZONIC-ID with a goal type, start
// time and a Tanga bet. Lifecycle: pending → accepted/declined; an accepted challenge whose start
// time has passed is reported as 'active' (live result tracking + bet settlement is a follow-up —
// the TZ models the live duel on the client). No fund movement happens here yet.
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatIso, parseFlexibleDateTime } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { FriendsService } from '../friends/friends.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ChallengeDto,
  ChallengeGoal,
  ChallengeListDto,
  ChallengeOkDto,
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
  bet: string;
  status: string;
  created_at: Date;
  winner_user_id: string | null;
}

@Injectable()
export class ChallengesService {
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

  async create(
    userId: string,
    opponentZonicId: number,
    goalType: ChallengeGoal,
    startAt: string,
  ): Promise<ChallengeDto> {
    const opponent = await this.friends.search(opponentZonicId); // 404 if missing
    if (opponent.userId === userId) throw badRequest(['You cannot challenge yourself.']);
    if (!(await this.friends.areFriends(userId, opponent.userId))) {
      throw badRequest(['You can only challenge a friend.']);
    }
    const start = parseFlexibleDateTime(startAt);
    if (!start) throw badRequest(['startAt is not a valid date.']);

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
      `INSERT INTO game_challenge (challenger_id, opponent_id, goal_type, start_at, bet, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id::text`,
      [userId, opponent.userId, goalType, start, ChallengesService.WINNER_PRIZE],
    );
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
        `SELECT id::text, challenger_id::text, opponent_id::text, goal_type, start_at, bet, status
           FROM game_challenge WHERE id = $1 FOR UPDATE`,
        [challengeId],
      );
      if (!c) throw badRequest(['Challenge not found.']);
      if (c.challenger_id !== userId && c.opponent_id !== userId) {
        throw badRequest(['You are not part of this challenge.']);
      }
      if (c.status === 'finished') return null; // idempotent — already settled, don't re-notify
      if (c.status !== 'accepted') throw badRequest(['Challenge is not active.']);
      if (new Date(c.start_at).getTime() > Date.now()) throw badRequest(['Challenge has not started.']);

      const now = new Date();
      const a = await ChallengesService.progress(manager, c.challenger_id, c.goal_type, c.start_at, now);
      const b = await ChallengesService.progress(manager, c.opponent_id, c.goal_type, c.start_at, now);

      let winner: string | null = null;
      if (a > b) winner = c.challenger_id;
      else if (b > a) winner = c.opponent_id;

      // System pays the winner a fixed prize (nothing was staked); a tie pays nobody.
      if (winner) {
        await ChallengesService.creditTanga(manager, winner, ChallengesService.WINNER_PRIZE);
      }
      await manager.query(
        `UPDATE game_challenge SET status = 'finished', winner_user_id = $2, finished_at = now()
          WHERE id = $1`,
        [challengeId, winner],
      );
      return { challengerId: c.challenger_id as string, opponentId: c.opponent_id as string, winner };
    });

    const dto = await this.getOne(challengeId, userId);
    if (settled) {
      // Notify (+push) both players of the result (once, when it actually settles).
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
    return dto;
  }

  private static async creditTanga(
    manager: { query: (sql: string, params?: unknown[]) => Promise<any> },
    userId: string,
    amount: number,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO game_user_wallet (user_id, tanga) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET tanga = game_user_wallet.tanga + $2, updated_at = now()`,
      [userId, amount],
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

  private async getOne(id: string, userId: string): Promise<ChallengeDto> {
    const [row] = await this.dataSource.query(`${ChallengesService.SELECT} WHERE c.id = $1`, [id]);
    return ChallengesService.toDto(row, userId);
  }

  private static readonly SELECT = `
    SELECT c.id::text, c.goal_type, c.start_at, c.bet, c.status, c.created_at,
           c.winner_user_id::text AS winner_user_id,
           ch.id::text AS challenger_id, ch.username AS challenger_name, ch.zonic_id AS challenger_zid,
           op.id::text AS opponent_id,   op.username AS opponent_name,   op.zonic_id AS opponent_zid
      FROM game_challenge c
      JOIN sys_user ch ON ch.id = c.challenger_id
      JOIN sys_user op ON op.id = c.opponent_id`;

  private static toDto(r: ChallengeRow, userId: string): ChallengeDto {
    // Accepted + start time passed → 'active' for the UI; everything else is the stored status.
    let status = r.status;
    if (status === 'accepted' && new Date(r.start_at).getTime() <= Date.now()) status = 'active';
    return {
      id: r.id,
      challenger: { userId: r.challenger_id, username: r.challenger_name, zonicId: r.challenger_zid },
      opponent: { userId: r.opponent_id, username: r.opponent_name, zonicId: r.opponent_zid },
      goalType: r.goal_type,
      startAt: formatIso(new Date(r.start_at)),
      bet: Number(r.bet),
      status,
      direction: r.challenger_id === userId ? 'outgoing' : 'incoming',
      winnerUserId: r.winner_user_id,
      createdAt: formatIso(new Date(r.created_at)),
    };
  }
}
