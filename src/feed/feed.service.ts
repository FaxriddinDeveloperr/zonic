// Social feed (Phase N): posts (+images, likes) and 24h stories. Image bytes live on disk under
// uploads/feed; metadata in game_post*/game_story. Per-post image count and stories-per-day are
// gated by the caller's subscription tier. The feed shows the caller's own + friends' content.
import { createReadStream, existsSync, mkdirSync, writeFileSync, ReadStream } from 'fs';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatIso } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { UploadedImage } from '../profile/profile.service';
import { FriendsService } from '../friends/friends.service';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  AuthorDto,
  FeedOkDto,
  FeedResponseDto,
  PostDto,
  StoriesResponseDto,
  StoryDto,
  UploadImageResponseDto,
} from './dto/feed.dto';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};
const imageUrl = (fileId: string): string => `/Feed/Image?fileId=${fileId}`;

@Injectable()
export class FeedService {
  private readonly dir = join(process.cwd(), 'uploads', 'feed');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly friends: FriendsService,
    private readonly subscription: SubscriptionService,
  ) {
    mkdirSync(this.dir, { recursive: true });
  }

  // ─── Images ───────────────────────────────────────────────────────────────
  saveImage(file: UploadedImage | undefined): UploadImageResponseDto {
    if (!file || !file.buffer?.length) throw badRequest(['No file uploaded (field "file").']);
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) throw badRequest(['Unsupported image type. Allowed: jpeg, png, webp, gif, heic.']);
    const fileId = `${randomUUID()}${ext}`;
    writeFileSync(join(this.dir, fileId), file.buffer);
    return { fileId };
  }

  openImage(fileId: string | undefined): { stream: ReadStream; contentType: string } {
    if (!fileId) throw badRequest(['fileId is required.']);
    const safe = basename(fileId);
    if (safe !== fileId || !/^[\w.-]+$/.test(safe)) throw badRequest(['Invalid fileId.']);
    const ext = safe.slice(safe.lastIndexOf('.')).toLowerCase();
    const full = join(this.dir, safe);
    if (!existsSync(full)) throw new NotFoundException('Image not found.');
    return { stream: createReadStream(full), contentType: EXT_TO_MIME[ext] ?? 'application/octet-stream' };
  }

  // ─── Posts ────────────────────────────────────────────────────────────────
  async createPost(
    userId: string,
    caption: string | undefined,
    type: string | undefined,
    imageFileIds: string[],
  ): Promise<PostDto> {
    const { features } = await this.subscription.getMe(userId);
    if (imageFileIds.length > features.imagesPerPost) {
      throw badRequest([
        `Your plan allows ${features.imagesPerPost} image(s) per post. Upgrade for more.`,
      ]);
    }

    const postId = await this.dataSource.transaction(async (manager) => {
      const [p]: Array<{ id: string }> = await manager.query(
        `INSERT INTO game_post (user_id, type, caption) VALUES ($1, $2, $3) RETURNING id::text`,
        [userId, type ?? 'photo', caption ?? null],
      );
      for (let i = 0; i < imageFileIds.length; i++) {
        await manager.query(
          `INSERT INTO game_post_image (post_id, file_id, ordinal) VALUES ($1, $2, $3)`,
          [p.id, imageFileIds[i], i],
        );
      }
      return p.id;
    });

    return (await this.getFeedPosts(userId, [postId]))[0];
  }

  async feed(userId: string, page: number, pageSize: number): Promise<FeedResponseDto> {
    const authorIds = [userId, ...(await this.friends.getFriendIds(userId))];
    const ids: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id::text FROM game_post
        WHERE user_id = ANY($1::uuid[])
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      [authorIds],
    );
    const items = await this.getFeedPosts(userId, ids.map((r) => r.id));
    return { items };
  }

  async like(userId: string, postId: string): Promise<FeedOkDto> {
    await this.dataSource.query(
      `INSERT INTO game_post_like (post_id, user_id) VALUES ($1, $2)
       ON CONFLICT (post_id, user_id) DO NOTHING`,
      [postId, userId],
    );
    return { ok: true };
  }

  async unlike(userId: string, postId: string): Promise<FeedOkDto> {
    await this.dataSource.query(
      `DELETE FROM game_post_like WHERE post_id = $1 AND user_id = $2`,
      [postId, userId],
    );
    return { ok: true };
  }

  /** Hydrate posts (in the given id order) with author, images, like count and likedByMe. */
  private async getFeedPosts(viewerId: string, postIds: string[]): Promise<PostDto[]> {
    if (postIds.length === 0) return [];
    const rows: Array<{
      id: string;
      type: string;
      caption: string | null;
      created_at: Date;
      author_id: string;
      username: string;
      avatar_file_id: string | null;
      images: string[] | null;
      like_count: string;
      liked_by_me: boolean;
    }> = await this.dataSource.query(
      `SELECT p.id::text, p.type, p.caption, p.created_at,
              u.id::text AS author_id, u.username, u.avatar_file_id,
              (SELECT array_agg(file_id ORDER BY ordinal) FROM game_post_image WHERE post_id = p.id) AS images,
              (SELECT COUNT(*) FROM game_post_like WHERE post_id = p.id) AS like_count,
              EXISTS(SELECT 1 FROM game_post_like WHERE post_id = p.id AND user_id = $2) AS liked_by_me
         FROM game_post p
         JOIN sys_user u ON u.id = p.user_id
        WHERE p.id = ANY($1::uuid[])`,
      [postIds, viewerId],
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    return postIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => ({
        id: r.id,
        author: FeedService.author(r.author_id, r.username, r.avatar_file_id),
        type: r.type,
        caption: r.caption,
        imageUrls: (r.images ?? []).map(imageUrl),
        likeCount: Number(r.like_count),
        likedByMe: r.liked_by_me,
        createdAt: formatIso(new Date(r.created_at)),
      }));
  }

  // ─── Stories ──────────────────────────────────────────────────────────────
  async createStory(userId: string, fileId: string): Promise<StoryDto> {
    const { features } = await this.subscription.getMe(userId);
    if (features.storiesPerDay === 0) {
      throw badRequest(['Stories are a Gold feature. Upgrade to post stories.']);
    }
    if (features.storiesPerDay > 0) {
      const [c]: Array<{ cnt: string }> = await this.dataSource.query(
        `SELECT COUNT(*) AS cnt FROM game_story
          WHERE user_id = $1 AND created_at::date = now()::date`,
        [userId],
      );
      if (Number(c.cnt) >= features.storiesPerDay) {
        throw badRequest([`Your plan allows ${features.storiesPerDay} story/day.`]);
      }
    }
    const [s]: Array<{ id: string; created_at: Date; expires_at: Date }> = await this.dataSource.query(
      `INSERT INTO game_story (user_id, file_id, expires_at)
       VALUES ($1, $2, now() + interval '24 hours')
       RETURNING id::text, created_at, expires_at`,
      [userId, fileId],
    );
    const [u] = await this.dataSource.query(
      `SELECT id::text, username, avatar_file_id FROM sys_user WHERE id = $1`,
      [userId],
    );
    return {
      id: s.id,
      author: FeedService.author(u.id, u.username, u.avatar_file_id),
      imageUrl: imageUrl(fileId),
      createdAt: formatIso(new Date(s.created_at)),
      expiresAt: formatIso(new Date(s.expires_at)),
    };
  }

  async stories(userId: string): Promise<StoriesResponseDto> {
    const authorIds = [userId, ...(await this.friends.getFriendIds(userId))];
    const rows: Array<{
      id: string;
      file_id: string;
      created_at: Date;
      expires_at: Date;
      author_id: string;
      username: string;
      avatar_file_id: string | null;
    }> = await this.dataSource.query(
      `SELECT s.id::text, s.file_id, s.created_at, s.expires_at,
              u.id::text AS author_id, u.username, u.avatar_file_id
         FROM game_story s
         JOIN sys_user u ON u.id = s.user_id
        WHERE s.user_id = ANY($1::uuid[]) AND s.expires_at > now()
        ORDER BY s.created_at DESC`,
      [authorIds],
    );
    const items: StoryDto[] = rows.map((r) => ({
      id: r.id,
      author: FeedService.author(r.author_id, r.username, r.avatar_file_id),
      imageUrl: imageUrl(r.file_id),
      createdAt: formatIso(new Date(r.created_at)),
      expiresAt: formatIso(new Date(r.expires_at)),
    }));
    return { items };
  }

  private static author(userId: string, username: string, avatar: string | null): AuthorDto {
    return { userId, username, avatarFileId: avatar };
  }
}
