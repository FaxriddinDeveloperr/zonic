// Mirrors Zonic.DataLayer/EFClasses/Game/LocationPoint.cs  →  table game_location_point
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('game_location_point')
export class LocationPoint {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'latitude', type: 'double precision' })
  latitude: number;

  @Column({ name: 'longitude', type: 'double precision' })
  longitude: number;

  @Column({ name: 'accuracy', type: 'double precision' })
  accuracy: number;

  @Column({ name: 'speed', type: 'double precision' })
  speed: number;

  @Column({ name: 'recorded_at', type: 'timestamp' })
  recordedAt: Date;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
