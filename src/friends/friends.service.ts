// Friends / Clan (Phase G). Search & friend by unique ZONIC-ID. Friendship is one row with a
// direction (requester → addressee) and a status; accepted rows count in both directions.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatIso } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { NotificationsService } from '../notifications/notifications.service';
import {
  FriendDto,
  FriendRequestItemDto,
  FriendsListDto,
  FriendRequestsDto,
  MyIdDto,
  OkDto,
  SearchUsersResponseDto,
  UserSummaryDto,
} from './dto/friends.dto';

@Injectable()
export class FriendsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /** Ensure the caller has a ZONIC-ID (lazy assign), returning their public card. */
  async me(userId: string): Promise<MyIdDto> {
    const zonicId = await this.ensureZonicId(userId);
    const [u] = await this.dataSource.query(
      `SELECT username, avatar_file_id, selected_frame_code FROM sys_user WHERE id = $1`,
      [userId],
    );
    return {
      zonicId,
      username: u.username,
      avatarFileId: u.avatar_file_id,
      selectedFrameCode: u.selected_frame_code ?? null,
    };
  }

  async search(zonicId: number): Promise<UserSummaryDto> {
    const [u] = await this.dataSource.query(
      `SELECT id::text, zonic_id, username, avatar_file_id, selected_frame_code, level
         FROM sys_user WHERE zonic_id = $1`,
      [zonicId],
    );
    if (!u) throw new NotFoundException('No user with that ZONIC-ID.');
    return {
      userId: u.id,
      zonicId: u.zonic_id,
      username: u.username,
      avatarFileId: u.avatar_file_id,
      selectedFrameCode: u.selected_frame_code ?? null,
      level: u.level,
    };
  }

  /**
   * People search: paste a ZONIC-ID (exact) or a username (exact or partial, case-insensitive).
   * Returns a list — a partial name can match several users. Excludes the caller.
   */
  async searchUsers(
    callerId: string,
    query: string,
    page: number,
    pageSize: number,
  ): Promise<SearchUsersResponseDto> {
    const q = query.trim();
    const asZonicId = /^\d+$/.test(q) ? Number(q) : null;
    const rows = await this.dataSource.query(
      `SELECT id::text, zonic_id, username, avatar_file_id, selected_frame_code, level
         FROM sys_user
        WHERE id <> $1
          AND ( ($2::bigint IS NOT NULL AND zonic_id = $2::bigint)
             OR username ILIKE '%' || $3 || '%' )
        ORDER BY (username ILIKE $3) DESC, username ASC
        LIMIT $4 OFFSET $5`,
      [callerId, asZonicId, q, pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows.map((u: any) => ({
        userId: u.id,
        zonicId: u.zonic_id,
        username: u.username,
        avatarFileId: u.avatar_file_id,
        selectedFrameCode: u.selected_frame_code ?? null,
        level: u.level,
      })),
    };
  }

  async sendRequest(userId: string, targetZonicId: number): Promise<OkDto> {
    const target = await this.search(targetZonicId); // 404 if not found
    if (target.userId === userId) throw badRequest(['You cannot add yourself.']);

    // Already friends or a pending request either way?
    const existing = await this.findRelation(userId, target.userId);
    if (existing) {
      if (existing.status === 'accepted') throw badRequest(['Already friends.']);
      // A pending request from the target → accept it instead of duplicating.
      if (existing.addressee_id === userId) {
        await this.dataSource.query(
          `UPDATE game_friendship SET status = 'accepted', responded_at = now() WHERE id = $1`,
          [existing.id],
        );
        return { ok: true, status: 'accepted' };
      }
      throw badRequest(['Request already pending.']);
    }

    const [row]: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO game_friendship (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending') RETURNING id::text`,
      [userId, target.userId],
    );
    // Notify the addressee (feeds the Notifications page + friend-request Accept button).
    const me = await this.me(userId);
    await this.notifications.create(
      target.userId,
      'friend_request',
      `${me.username} sizga do'stlik so'rovi yubordi`,
      null,
      { requestId: row.id, fromUserId: userId, fromZonicId: me.zonicId, fromUsername: me.username },
    );
    return { ok: true, status: 'pending' };
  }

  async respond(userId: string, requestId: string, accept: boolean): Promise<OkDto> {
    const [row] = await this.dataSource.query(
      `SELECT id::text, requester_id::text, addressee_id::text, status
         FROM game_friendship WHERE id = $1`,
      [requestId],
    );
    if (!row || row.addressee_id !== userId || row.status !== 'pending') {
      throw badRequest(['No pending request to respond to.']);
    }
    // Responder's identity — so the requester's notification says who accepted/declined.
    const [me] = await this.dataSource.query(
      `SELECT zonic_id, username FROM sys_user WHERE id = $1`,
      [userId],
    );
    const who = me?.username ?? 'Foydalanuvchi';
    const payload = { fromUserId: userId, fromZonicId: me?.zonic_id ?? null, fromUsername: me?.username ?? null };

    if (accept) {
      await this.dataSource.query(
        `UPDATE game_friendship SET status = 'accepted', responded_at = now() WHERE id = $1`,
        [requestId],
      );
      await this.notifications.create(
        row.requester_id,
        'friend_accepted',
        `${who} do'stlik so'rovingizni qabul qildi`,
        null,
        payload,
      );
      return { ok: true, status: 'accepted' };
    }
    await this.dataSource.query(`DELETE FROM game_friendship WHERE id = $1`, [requestId]);
    await this.notifications.create(
      row.requester_id,
      'friend_rejected',
      `${who} do'stlik so'rovingizni rad etdi`,
      null,
      payload,
    );
    return { ok: true, status: 'rejected' };
  }

  async list(userId: string): Promise<FriendsListDto> {
    // The friend is whichever side of an accepted row isn't the caller. lastActivity = max across
    // free runs / steps / territory; hasTerritory = owns any zone.
    const rows: Array<{
      id: string;
      zonic_id: number;
      username: string;
      avatar_file_id: string | null;
      selected_frame_code: string | null;
      level: string | null;
      last_activity: Date | null;
      has_territory: boolean;
    }> = await this.dataSource.query(
      `SELECT u.id::text, u.zonic_id, u.username, u.avatar_file_id, u.selected_frame_code, u.level,
              GREATEST(
                COALESCE((SELECT MAX(started_at) FROM game_free_run WHERE user_id = u.id), 'epoch'),
                COALESCE((SELECT MAX(started_at) FROM game_step_activity WHERE user_id = u.id), 'epoch'),
                COALESCE((SELECT MAX(captured_at)::timestamp FROM game_territory WHERE owner_user_id = u.id), 'epoch')
              ) AS last_activity,
              EXISTS(SELECT 1 FROM game_territory WHERE owner_user_id = u.id) AS has_territory
         FROM game_friendship f
         JOIN sys_user u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
        WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
        ORDER BY last_activity DESC`,
      [userId],
    );
    const friends: FriendDto[] = rows.map((r) => {
      const la = r.last_activity ? new Date(r.last_activity) : null;
      const isEpoch = la != null && la.getTime() <= 0;
      return {
        userId: r.id,
        zonicId: r.zonic_id,
        username: r.username,
        avatarFileId: r.avatar_file_id,
        selectedFrameCode: r.selected_frame_code,
        level: r.level,
        lastActivityAt: la && !isEpoch ? formatIso(la) : null,
        hasTerritory: r.has_territory,
      };
    });
    return { friends };
  }

  async incomingRequests(userId: string): Promise<FriendRequestsDto> {
    const rows: Array<{
      id: string;
      created_at: Date;
      from_id: string;
      zonic_id: number;
      username: string;
      avatar_file_id: string | null;
      selected_frame_code: string | null;
      level: string | null;
    }> = await this.dataSource.query(
      `SELECT f.id::text, f.created_at, u.id::text AS from_id, u.zonic_id, u.username,
              u.avatar_file_id, u.selected_frame_code, u.level
         FROM game_friendship f
         JOIN sys_user u ON u.id = f.requester_id
        WHERE f.addressee_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC`,
      [userId],
    );
    const requests: FriendRequestItemDto[] = rows.map((r) => ({
      requestId: r.id,
      createdAt: formatIso(new Date(r.created_at)),
      from: {
        userId: r.from_id,
        zonicId: r.zonic_id,
        username: r.username,
        avatarFileId: r.avatar_file_id,
        selectedFrameCode: r.selected_frame_code,
        level: r.level,
      },
    }));
    return { requests };
  }

  async unfriend(userId: string, otherUserId: string): Promise<OkDto> {
    await this.dataSource.query(
      `DELETE FROM game_friendship
        WHERE status = 'accepted'
          AND ((requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1))`,
      [userId, otherUserId],
    );
    return { ok: true };
  }

  /** Accepted-friend user ids of the caller (used by the social feed). */
  async getFriendIds(userId: string): Promise<string[]> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END::text AS id
         FROM game_friendship
        WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)`,
      [userId],
    );
    return rows.map((r) => r.id);
  }

  /** True when the two users are accepted friends (used by the Challenge feature). */
  async areFriends(a: string, b: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT 1 FROM game_friendship
        WHERE status = 'accepted'
          AND ((requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)) LIMIT 1`,
      [a, b],
    );
    return !!row;
  }

  private async findRelation(
    a: string,
    b: string,
  ): Promise<{ id: string; addressee_id: string; status: string } | null> {
    const [row] = await this.dataSource.query(
      `SELECT id::text, addressee_id::text, status FROM game_friendship
        WHERE (requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1) LIMIT 1`,
      [a, b],
    );
    return row ?? null;
  }

  private async ensureZonicId(userId: string): Promise<number> {
    const [u] = await this.dataSource.query(
      `SELECT zonic_id FROM sys_user WHERE id = $1`,
      [userId],
    );
    if (u?.zonic_id != null) return Number(u.zonic_id);
    // Assign a unique 6-digit id (retry on the rare collision). The `zonic_id IS NULL` guard
    // prevents overwriting a value set concurrently. NOTE: TypeORM's query() returns
    // [rows, affectedCount] for UPDATE ... RETURNING (unlike INSERT), so we re-SELECT to read
    // the value reliably instead of parsing the UPDATE result.
    for (let i = 0; i < 20; i++) {
      const candidate = 100000 + Math.floor(Math.random() * 900000);
      await this.dataSource.query(
        `UPDATE sys_user SET zonic_id = $2
          WHERE id = $1 AND zonic_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM sys_user WHERE zonic_id = $2)`,
        [userId, candidate],
      );
      const [check] = await this.dataSource.query(
        `SELECT zonic_id FROM sys_user WHERE id = $1`,
        [userId],
      );
      if (check?.zonic_id != null) return Number(check.zonic_id);
    }
    throw badRequest(['Could not allocate a ZONIC-ID, please retry.']);
  }
}
