// Notifications (BACKEND_TODO §2). Raw SQL over game_notification. create() is called by other
// features (e.g. friend requests) to push a notification to a user.
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatIso } from '../common/helpers/datetime';
import {
  NotificationDto,
  NotificationsResponseDto,
  OkDto,
} from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Push a notification to a user (used by other modules). */
  async create(
    userId: string,
    type: string,
    title: string,
    body: string | null,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO game_notification (user_id, type, title, body, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [userId, type, title, body, JSON.stringify(payload)],
    );
  }

  async list(userId: string, page: number, pageSize: number): Promise<NotificationsResponseDto> {
    const rows: Array<{
      id: string;
      type: string;
      title: string;
      body: string | null;
      payload: Record<string, unknown>;
      is_read: boolean;
      created_at: Date;
    }> = await this.dataSource.query(
      `SELECT id::text, type, title, body, payload, is_read, created_at
         FROM game_notification WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      [userId],
    );
    const [{ cnt }] = await this.dataSource.query(
      `SELECT COUNT(*) AS cnt FROM game_notification WHERE user_id = $1 AND is_read = false`,
      [userId],
    );
    const items: NotificationDto[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      payload: r.payload ?? {},
      isRead: r.is_read,
      createdAt: formatIso(new Date(r.created_at)),
    }));
    return { items, unreadCount: Number(cnt) };
  }

  /** Mark the given ids read, or ALL of the user's notifications if ids is empty/omitted. */
  async markRead(userId: string, ids?: string[]): Promise<OkDto> {
    if (ids && ids.length > 0) {
      await this.dataSource.query(
        `UPDATE game_notification SET is_read = true WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [userId, ids],
      );
    } else {
      await this.dataSource.query(
        `UPDATE game_notification SET is_read = true WHERE user_id = $1 AND is_read = false`,
        [userId],
      );
    }
    return { ok: true };
  }

  async remove(userId: string, id: string): Promise<OkDto> {
    await this.dataSource.query(
      `DELETE FROM game_notification WHERE user_id = $1 AND id = $2`,
      [userId, id],
    );
    return { ok: true };
  }

  async removeAll(userId: string): Promise<OkDto> {
    await this.dataSource.query(`DELETE FROM game_notification WHERE user_id = $1`, [userId]);
    return { ok: true };
  }
}
