// Pedometer activity saved in one shot from the app (Phase E) → table game_step_activity.
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('game_step_activity')
export class StepActivity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamp' })
  endedAt: Date;

  @Column({ name: 'duration_seconds', type: 'int', default: 0 })
  durationSeconds: number;

  @Column({ name: 'steps', type: 'int', default: 0 })
  steps: number;

  @Column({ name: 'distance_km', type: 'double precision', default: 0 })
  distanceKm: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
