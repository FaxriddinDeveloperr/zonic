// Mirrors AppSettings.cs (Database / Jwt / Game sections).
const num = (v: string | undefined, def: number): number =>
  v === undefined || v === '' ? def : Number(v);

export interface GameConfig {
  zonePrecision: number;
  groupPrecision: number;
  maxSpeedMps: number;
  minAccuracyMeters: number;
  rateLimitSeconds: number;
  batchSize: number;
  batchIntervalMs: number;
  // Territory capture (PostGIS polygon zones)
  bufferRadiusM: number; // path → polygon buffer radius (m)
  closeLoopDistanceM: number; // max start↔finish distance to count as a closed loop (m)
  minRunDistanceM: number; // shortest run distance that may capture a zone (m)
  overtakeFactor: number; // distance multiplier to take another's zone
  minZoneAreaM2: number; // zone remainder smaller than this is deleted
  mergeCentroidM: number; // same-user zones merge if centroids within this (m)
  captureDistanceRatio: number; // full capture: run_km ≥ area_km² × ratio
}

export interface JwtConfig {
  secretKey: string;
  issuer: string;
  audience: string;
  accessTokenExpirationMinutes: number;
  refreshTokenExpirationDays: number;
}

export interface SocialAuthConfig {
  // Accepted `aud` values for Google ID tokens (iOS / Android / web client IDs).
  googleClientIds: string[];
  // Accepted `aud` values for Apple identity tokens (app bundle id / service id).
  appleClientIds: string[];
}

export interface AppConfiguration {
  port: number;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  jwt: JwtConfig;
  game: GameConfig;
  social: SocialAuthConfig;
}

// Comma-separated env value → trimmed non-empty list.
const csv = (v: string | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

export default (): AppConfiguration => ({
  port: num(process.env.PORT, 5065),
  database: {
    host: process.env.PGHOST || 'localhost',
    port: num(process.env.PGPORT, 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'zonic',
  },
  jwt: {
    secretKey: process.env.JWT_SECRET_KEY || 'YourSuperSecretKeyThatIsAtLeast32BytesLong!!',
    issuer: process.env.JWT_ISSUER || 'ZonicApi',
    audience: process.env.JWT_AUDIENCE || 'ZonicApp',
    accessTokenExpirationMinutes: num(process.env.JWT_ACCESS_TOKEN_EXPIRATION_MINUTES, 600),
    refreshTokenExpirationDays: num(process.env.JWT_REFRESH_TOKEN_EXPIRATION_DAYS, 30),
  },
  game: {
    zonePrecision: num(process.env.GAME_ZONE_PRECISION, 7),
    groupPrecision: num(process.env.GAME_GROUP_PRECISION, 5),
    maxSpeedMps: num(process.env.GAME_MAX_SPEED_MPS, 12.0),
    minAccuracyMeters: num(process.env.GAME_MIN_ACCURACY_METERS, 50.0),
    rateLimitSeconds: num(process.env.GAME_RATE_LIMIT_SECONDS, 1.0),
    batchSize: num(process.env.GAME_BATCH_SIZE, 100),
    batchIntervalMs: num(process.env.GAME_BATCH_INTERVAL_MS, 1000),
    bufferRadiusM: num(process.env.GAME_BUFFER_RADIUS_M, 15),
    closeLoopDistanceM: num(process.env.GAME_CLOSE_LOOP_DISTANCE_M, 150),
    minRunDistanceM: num(process.env.GAME_MIN_RUN_DISTANCE_M, 500),
    overtakeFactor: num(process.env.GAME_OVERTAKE_FACTOR, 1.4),
    minZoneAreaM2: num(process.env.GAME_MIN_ZONE_AREA_M2, 10),
    mergeCentroidM: num(process.env.GAME_MERGE_CENTROID_M, 500),
    captureDistanceRatio: num(process.env.GAME_CAPTURE_DISTANCE_RATIO, 1.33),
  },
  social: {
    googleClientIds: csv(process.env.GOOGLE_CLIENT_ID),
    appleClientIds: csv(process.env.APPLE_CLIENT_ID),
  },
});
