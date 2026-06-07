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

  @Column({ name: 'stateid' })
  stateId: number;

  @Column({ name: 'dateofcreated', type: 'timestamp', default: () => 'now()' })
  dateOfCreated: Date;
}
