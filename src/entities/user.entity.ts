// Mirrors Zonic.DataLayer/EFClasses/Sys/User.cs  →  table sys_user
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sys_user')
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'username' })
  username: string;

  @Column({ name: 'email', type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ name: 'password_salt', type: 'text' })
  passwordSalt: string;

  // Stable Google account id (`sub` of the verified ID token); null for non-Google users.
  @Column({ name: 'google_user_id', type: 'varchar', nullable: true })
  googleUserId: string | null;

  // Stable Apple account id (`sub` of the verified identity token); null for non-Apple users.
  @Column({ name: 'apple_user_id', type: 'varchar', nullable: true })
  appleUserId: string | null;

  // Identifier of the uploaded avatar file (UploadAvatar → DownloadAvatar); null until set.
  @Column({ name: 'avatar_file_id', type: 'varchar', nullable: true })
  avatarFileId: string | null;

  // Personal/team color (hex) applied to all of the user's territory zones; null → default.
  @Column({ name: 'color', type: 'varchar', nullable: true })
  color: string | null;

  @Column({ name: 'stateid' })
  stateId: number;

  // Unique public numeric id used for friend search / sharing (Phase G); null until assigned.
  @Column({ name: 'zonic_id', type: 'int', nullable: true })
  zonicId: number | null;

  // ─── Onboarding / profile fields (Phase D). Single source of truth for the app. ───
  @Column({ name: 'country_id', type: 'int', nullable: true })
  countryId: number | null;

  @Column({ name: 'region_id', type: 'int', nullable: true })
  regionId: number | null;

  @Column({ name: 'age', type: 'int', nullable: true })
  age: number | null;

  @Column({ name: 'height_cm', type: 'double precision', nullable: true })
  heightCm: number | null;

  @Column({ name: 'weight_kg', type: 'double precision', nullable: true })
  weightKg: number | null;

  @Column({ name: 'gender', type: 'varchar', nullable: true })
  gender: string | null;

  @Column({ name: 'level', type: 'varchar', nullable: true })
  level: string | null;

  // Privacy zone (Phase N): hide the home area on shared maps; route points inside are clipped.
  @Column({ name: 'privacy_lat', type: 'double precision', nullable: true })
  privacyLat: number | null;

  @Column({ name: 'privacy_lng', type: 'double precision', nullable: true })
  privacyLng: number | null;

  @Column({ name: 'privacy_radius_m', type: 'double precision', nullable: true })
  privacyRadiusM: number | null;

  @Column({ name: 'dateofcreated', type: 'timestamp', default: () => 'now()' })
  dateOfCreated: Date;
}
