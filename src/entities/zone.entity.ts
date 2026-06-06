// Mirrors Zonic.DataLayer/EFClasses/Game/Zone.cs  →  table game_zone
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('game_zone')
export class Zone {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'geohash' })
  geohash: string;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ name: 'captured_at', type: 'timestamp', nullable: true })
  capturedAt: Date | null;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_user_id' })
  ownerUser?: User;
}
