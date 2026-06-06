// Mirrors Zonic.DataLayer/EFClasses/Game/UserLocation.cs  →  table game_user_location
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('game_user_location')
export class UserLocation {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'latitude', type: 'double precision' })
  latitude: number;

  @Column({ name: 'longitude', type: 'double precision' })
  longitude: number;

  @Column({ name: 'accuracy', type: 'double precision' })
  accuracy: number;

  @Column({ name: 'speed', type: 'double precision' })
  speed: number;

  @Column({ name: 'geohash' })
  geohash: string;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt: Date;
}
