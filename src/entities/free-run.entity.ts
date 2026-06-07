// Free run saved in one shot from the app (HTTP) → table game_free_run.
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** One GPS sample of the recorded route. `ts` stored as ISO-8601 UTC. */
export interface RoutePoint {
  lat: number;
  lng: number;
  ts: string;
}

@Entity('game_free_run')
export class FreeRun {
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

  @Column({ name: 'pace_min_per_km', type: 'double precision', default: 0 })
  paceMinPerKm: number;

  @Column({ name: 'average_speed_kmh', type: 'double precision', default: 0 })
  averageSpeedKmh: number;

  @Column({ name: 'distance_km', type: 'double precision', default: 0 })
  distanceKm: number;

  @Column({ name: 'route_points', type: 'jsonb', default: () => "'[]'::jsonb" })
  routePoints: RoutePoint[];

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
