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
}

export interface JwtConfig {
  secretKey: string;
  issuer: string;
  audience: string;
  accessTokenExpirationMinutes: number;
  refreshTokenExpirationDays: number;
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
}

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
  },
});
