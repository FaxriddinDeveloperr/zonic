// Achievement (badge) definitions — data for the Achievements system (Profile TZ §"Yutuqlar Tizimi").
// Only Distance and Territory families are active in this phase, as the TZ specifies.
// Thresholds are cumulative lifetime totals: distance in KM, territory in KM².
// Codes are stable identifiers stored in game_user_achievement; never rename an existing code.

export type AchievementType = 'distance' | 'territory';

export interface AchievementDef {
  /** Stable id persisted on unlock — do not change once shipped. */
  code: string;
  type: AchievementType;
  /** Lifetime total at which the badge unlocks (km for distance, km² for territory). */
  threshold: number;
  /** Display unit for the mobile UI. */
  unit: 'km' | 'km²';
  title: string;
}

export const DISTANCE_ACHIEVEMENTS: AchievementDef[] = [
  { code: 'dist_5', type: 'distance', threshold: 5, unit: 'km', title: '5 km' },
  { code: 'dist_10', type: 'distance', threshold: 10, unit: 'km', title: '10 km' },
  { code: 'dist_25', type: 'distance', threshold: 25, unit: 'km', title: '25 km' },
  { code: 'dist_50', type: 'distance', threshold: 50, unit: 'km', title: '50 km' },
  { code: 'dist_100', type: 'distance', threshold: 100, unit: 'km', title: '100 km' },
  { code: 'dist_250', type: 'distance', threshold: 250, unit: 'km', title: '250 km' },
  { code: 'dist_500', type: 'distance', threshold: 500, unit: 'km', title: '500 km' },
  { code: 'dist_1000', type: 'distance', threshold: 1000, unit: 'km', title: '1000 km' },
];

export const TERRITORY_ACHIEVEMENTS: AchievementDef[] = [
  { code: 'terr_0_5', type: 'territory', threshold: 0.5, unit: 'km²', title: '0.5 km²' },
  { code: 'terr_1', type: 'territory', threshold: 1, unit: 'km²', title: '1 km²' },
  { code: 'terr_5', type: 'territory', threshold: 5, unit: 'km²', title: '5 km²' },
  { code: 'terr_10', type: 'territory', threshold: 10, unit: 'km²', title: '10 km²' },
  { code: 'terr_25', type: 'territory', threshold: 25, unit: 'km²', title: '25 km²' },
  { code: 'terr_50', type: 'territory', threshold: 50, unit: 'km²', title: '50 km²' },
  { code: 'terr_100', type: 'territory', threshold: 100, unit: 'km²', title: '100 km²' },
];

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  ...DISTANCE_ACHIEVEMENTS,
  ...TERRITORY_ACHIEVEMENTS,
];
