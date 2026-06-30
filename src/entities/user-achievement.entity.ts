// Persisted achievement unlock state → table game_user_achievement.
// Definitions (thresholds/titles) live in src/common/achievements.ts; this table only records
// WHICH badge a user has unlocked and WHEN, so the unlock date survives later data changes.
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('game_user_achievement')
export class UserAchievement {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'achievement_code' })
  achievementCode: string;

  @Column({ name: 'unlocked_at', type: 'timestamp', default: () => 'now()' })
  unlockedAt: Date;
}
