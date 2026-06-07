// Profile read + avatar upload/download (GET /UserProfile/GetMe, UploadAvatar, DownloadAvatar).
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadStream } from 'fs';
import { User } from '../entities/user.entity';
import { badRequest } from '../common/validation-problem';
import { MeDto } from './dto/me.dto';

/** Minimal shape of a multer in-memory file (avoids a hard dep on @types/multer). */
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Accepted image types → file extension used on disk.
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
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

@Injectable()
export class ProfileService {
  private readonly avatarDir = join(process.cwd(), 'uploads', 'avatars');

  constructor(@InjectRepository(User) private readonly users: Repository<User>) {
    mkdirSync(this.avatarDir, { recursive: true });
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    return {
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatarFileId: user.avatarFileId,
      color: user.color,
    };
  }

  async saveAvatar(userId: string, file: UploadedImage | undefined): Promise<{ fileId: string }> {
    if (!file || !file.buffer?.length) {
      throw badRequest(['No file uploaded (expected form field "file").']);
    }
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw badRequest(['Unsupported image type. Allowed: jpeg, png, webp, gif, heic.']);
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const fileId = `${randomUUID()}${ext}`;
    writeFileSync(join(this.avatarDir, fileId), file.buffer);

    user.avatarFileId = fileId;
    await this.users.save(user);

    return { fileId };
  }

  /** Validates fileId (no path traversal) and returns an open stream + content type. */
  openAvatar(fileId: string | undefined): { stream: ReadStream; contentType: string } {
    if (!fileId) throw badRequest(['fileId is required.']);
    const safe = basename(fileId); // strip any path components
    if (safe !== fileId || !/^[\w.-]+$/.test(safe)) {
      throw badRequest(['Invalid fileId.']);
    }

    const dot = safe.lastIndexOf('.');
    const ext = dot >= 0 ? safe.slice(dot).toLowerCase() : '';
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

    const full = join(this.avatarDir, safe);
    if (!existsSync(full)) throw new NotFoundException('Avatar not found.');

    return { stream: createReadStream(full), contentType };
  }
}
