// Clan groups (Phase M follow-up). Creating a clan needs the Gold+ canCreateClan feature; joining
// is open. One clan per user (game_clan_member PK = user_id). Leader can only leave once they are
// the last member (which disbands the clan) — otherwise they must let members go / transfer first.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatIso } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  ClanDto,
  ClanLeaderboardDto,
  ClanListDto,
  ClanMemberDto,
  ClanMembersDto,
  ClanOkDto,
  MyClanDto,
} from './dto/clan.dto';

@Injectable()
export class ClanService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscription: SubscriptionService,
  ) {}

  async create(userId: string, name: string, color?: string): Promise<ClanDto> {
    const sub = await this.subscription.getMe(userId);
    if (!sub.features.canCreateClan) {
      throw badRequest(['Creating a clan is a Gold+ feature.']);
    }
    if (await this.currentClanId(userId)) throw badRequest(['You are already in a clan.']);

    const [dupe] = await this.dataSource.query(`SELECT 1 FROM game_clan WHERE name = $1`, [name]);
    if (dupe) throw badRequest(['A clan with that name already exists.']);

    const clanId = await this.dataSource.transaction(async (manager) => {
      const [c]: Array<{ id: string }> = await manager.query(
        `INSERT INTO game_clan (name, owner_user_id, color) VALUES ($1, $2, $3) RETURNING id::text`,
        [name, userId, color ?? null],
      );
      await manager.query(
        `INSERT INTO game_clan_member (user_id, clan_id, role) VALUES ($1, $2, 'leader')`,
        [userId, c.id],
      );
      return c.id;
    });
    return this.getClan(clanId);
  }

  async list(page: number, pageSize: number): Promise<ClanListDto> {
    const rows: ClanRow[] = await this.dataSource.query(
      `${ClanService.SELECT} ORDER BY c.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    );
    return { items: rows.map(ClanService.toClan) };
  }

  async join(userId: string, clanId: string): Promise<ClanOkDto> {
    if (await this.currentClanId(userId)) throw badRequest(['Leave your current clan first.']);
    const [clan] = await this.dataSource.query(`SELECT 1 FROM game_clan WHERE id = $1`, [clanId]);
    if (!clan) throw new NotFoundException('Clan not found.');
    await this.dataSource.query(
      `INSERT INTO game_clan_member (user_id, clan_id, role) VALUES ($1, $2, 'member')`,
      [userId, clanId],
    );
    return { ok: true };
  }

  async leave(userId: string): Promise<ClanOkDto> {
    const [m] = await this.dataSource.query(
      `SELECT clan_id::text, role FROM game_clan_member WHERE user_id = $1`,
      [userId],
    );
    if (!m) throw badRequest(['You are not in a clan.']);
    if (m.role === 'leader') {
      const [{ cnt }] = await this.dataSource.query(
        `SELECT COUNT(*) AS cnt FROM game_clan_member WHERE clan_id = $1`,
        [m.clan_id],
      );
      if (Number(cnt) > 1) {
        throw badRequest(['As leader, transfer leadership or remove members before leaving.']);
      }
      // Last member → disband (cascade removes the membership row).
      await this.dataSource.query(`DELETE FROM game_clan WHERE id = $1`, [m.clan_id]);
      return { ok: true };
    }
    await this.dataSource.query(`DELETE FROM game_clan_member WHERE user_id = $1`, [userId]);
    return { ok: true };
  }

  async mine(userId: string): Promise<MyClanDto> {
    const clanId = await this.currentClanId(userId);
    if (!clanId) return { clan: null, role: null, members: [] };
    const [{ role }] = await this.dataSource.query(
      `SELECT role FROM game_clan_member WHERE user_id = $1`,
      [userId],
    );
    return { clan: await this.getClan(clanId), role, members: (await this.members(clanId)).members };
  }

  async members(clanId: string): Promise<ClanMembersDto> {
    const rows: Array<{
      user_id: string;
      username: string;
      zonic_id: number | null;
      role: string;
      joined_at: Date;
    }> = await this.dataSource.query(
      `SELECT m.user_id::text, u.username, u.zonic_id, m.role, m.joined_at
         FROM game_clan_member m JOIN sys_user u ON u.id = m.user_id
        WHERE m.clan_id = $1
        ORDER BY (m.role = 'leader') DESC, m.joined_at ASC`,
      [clanId],
    );
    const members: ClanMemberDto[] = rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      zonicId: r.zonic_id,
      role: r.role,
      joinedAt: formatIso(new Date(r.joined_at)),
    }));
    return { members };
  }

  async leaderboard(page: number, pageSize: number): Promise<ClanLeaderboardDto> {
    const rows: Array<{
      clan_id: string;
      name: string;
      member_count: string;
      total_m: string | null;
    }> = await this.dataSource.query(
      `SELECT c.id::text AS clan_id, c.name,
              (SELECT COUNT(*) FROM game_clan_member WHERE clan_id = c.id) AS member_count,
              COALESCE(SUM(s.total_distance_meters), 0) AS total_m
         FROM game_clan c
         JOIN game_clan_member m ON m.clan_id = c.id
         LEFT JOIN game_run_session s ON s.user_id = m.user_id AND s.ended_at IS NOT NULL
        GROUP BY c.id, c.name
        ORDER BY total_m DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    );
    let rank = (page - 1) * pageSize + 1;
    return {
      items: rows.map((r) => ({
        rank: rank++,
        clanId: r.clan_id,
        name: r.name,
        totalDistanceKm: Math.round((Number(r.total_m ?? 0) / 1000) * 100) / 100,
        memberCount: Number(r.member_count),
      })),
    };
  }

  private async currentClanId(userId: string): Promise<string | null> {
    const [m] = await this.dataSource.query(
      `SELECT clan_id::text FROM game_clan_member WHERE user_id = $1`,
      [userId],
    );
    return m?.clan_id ?? null;
  }

  private async getClan(clanId: string): Promise<ClanDto> {
    const [row] = await this.dataSource.query(`${ClanService.SELECT} WHERE c.id = $1`, [clanId]);
    if (!row) throw new NotFoundException('Clan not found.');
    return ClanService.toClan(row);
  }

  private static readonly SELECT = `
    SELECT c.id::text, c.name, c.color, c.owner_user_id::text AS owner_user_id, c.created_at,
           (SELECT COUNT(*) FROM game_clan_member WHERE clan_id = c.id) AS member_count
      FROM game_clan c`;

  private static toClan(r: ClanRow): ClanDto {
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      ownerUserId: r.owner_user_id,
      memberCount: Number(r.member_count),
      createdAt: formatIso(new Date(r.created_at)),
    };
  }
}

interface ClanRow {
  id: string;
  name: string;
  color: string | null;
  owner_user_id: string;
  created_at: Date;
  member_count: string;
}
