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
import { bmiCategory, caloriePerKm, computeBmi } from '../common/helpers/health';
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
  private readonly coverDir = join(process.cwd(), 'uploads', 'cover');

  constructor(@InjectRepository(User) private readonly users: Repository<User>) {
    mkdirSync(this.avatarDir, { recursive: true });
    mkdirSync(this.coverDir, { recursive: true });
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const bmi = computeBmi(user.heightCm, user.weightKg);
    return {
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatarFileId: user.avatarFileId,
      coverFileId: user.coverFileId,
      bio: user.bio,
      instagramUsername: user.instagramUsername,
      stravaUrl: user.stravaUrl,
      selectedBadgeCode: user.selectedBadgeCode,
      selectedFrameCode: user.selectedFrameCode,
      stepGoal: user.stepGoal,
      color: user.color,
      countryId: user.countryId,
      regionId: user.regionId,
      age: user.age,
      heightCm: user.heightCm,
      weightKg: user.weightKg,
      gender: user.gender,
      level: user.level,
      bmi,
      bmiCategory: bmiCategory(bmi),
      caloriePerKm: caloriePerKm(user.weightKg, user.gender),
      onboardingCompleted: ProfileService.isOnboardingComplete(user),
      privacyLat: user.privacyLat,
      privacyLng: user.privacyLng,
      privacyRadiusM: user.privacyRadiusM,
    };
  }

  /** Required onboarding fields per the TZ — UI routes to onboarding until all are set. */
  private static isOnboardingComplete(u: User): boolean {
    return (
      u.countryId != null &&
      u.age != null &&
      u.heightCm != null &&
      u.weightKg != null &&
      u.gender != null &&
      u.level != null
    );
  }

  saveAvatar(userId: string, file: UploadedImage | undefined): Promise<{ fileId: string }> {
    return this.saveImage(userId, file, this.avatarDir, (u, id) => (u.avatarFileId = id));
  }

  saveCover(userId: string, file: UploadedImage | undefined): Promise<{ fileId: string }> {
    return this.saveImage(userId, file, this.coverDir, (u, id) => (u.coverFileId = id));
  }

  /** Validates fileId (no path traversal) and returns an open stream + content type. */
  openAvatar(fileId: string | undefined): { stream: ReadStream; contentType: string } {
    return this.openImage(fileId, this.avatarDir, 'Avatar');
  }

  openCover(fileId: string | undefined): { stream: ReadStream; contentType: string } {
    return this.openImage(fileId, this.coverDir, 'Cover');
  }

  private async saveImage(
    userId: string,
    file: UploadedImage | undefined,
    dir: string,
    setFileId: (u: User, id: string) => void,
  ): Promise<{ fileId: string }> {
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
    writeFileSync(join(dir, fileId), file.buffer);

    setFileId(user, fileId);
    await this.users.save(user);

    return { fileId };
  }

  private openImage(
    fileId: string | undefined,
    dir: string,
    kind: string,
  ): { stream: ReadStream; contentType: string } {
    if (!fileId) throw badRequest(['fileId is required.']);
    const safe = basename(fileId); // strip any path components
    if (safe !== fileId || !/^[\w.-]+$/.test(safe)) {
      throw badRequest(['Invalid fileId.']);
    }

    const dot = safe.lastIndexOf('.');
    const ext = dot >= 0 ? safe.slice(dot).toLowerCase() : '';
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

    const full = join(dir, safe);
    if (!existsSync(full)) throw new NotFoundException(`${kind} not found.`);

    return { stream: createReadStream(full), contentType };
  }
}
