// Mirrors Zonic.DataLayer/EFClasses/Game/RunSession.cs  →  table game_run_session
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RunType } from './run-type.entity';

@Entity('game_run_session')
export class RunSession {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'run_type_id' })
  runTypeId: number;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'total_distance_meters', type: 'double precision', default: 0 })
  totalDistanceMeters: number;

  @Column({ name: 'avg_speed_kmh', type: 'double precision', default: 0 })
  avgSpeedKmh: number;

  @ManyToOne(() => RunType)
  @JoinColumn({ name: 'run_type_id' })
  runType?: RunType;
}
