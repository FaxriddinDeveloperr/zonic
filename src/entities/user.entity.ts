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

  @Column({ name: 'stateid' })
  stateId: number;

  @Column({ name: 'dateofcreated', type: 'timestamp', default: () => 'now()' })
  dateOfCreated: Date;
}
