// Territory capture (PostGIS polygon zones). Replaces the old geohash ZoneService.
// All spatial work is raw SQL — TypeORM doesn't model geometry natively.
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GameConfig } from '../config/configuration';
import { haversineDistance } from '../common/helpers/geohash';
import { formatDate, formatDateTime } from '../common/helpers/datetime';
import { ZoneAreaRequestDto } from './dto/zone-area-request.dto';
import { LatLngDto, ZoneItemDto } from './dto/zone-item.dto';
import { ZoneDetailsDto } from './dto/zone-details.dto';

const DEFAULT_COLOR = '#3B82F6';

// Normalise any geometry expression to a valid MultiPolygon (drops stray lines/points).
const NORM = (expr: string): string =>
  `ST_Multi(ST_CollectionExtract(ST_MakeValid(${expr}), 3))`;

/** Minimal session info needed to build a territory at StopRun. */
export interface CaptureSession {
  userId: string;
  runTypeId: number;
  startedAt: Date;
  endedAt: Date;
}

export interface CaptureResult {
  closed: boolean; // start↔finish within close-loop distance
  saved: boolean; // a polygon was actually created
  zoneId?: string;
  areaKm2?: number;
  centroidLat?: number;
  centroidLng?: number;
}

interface PointRow {
  latitude: number;
  longitude: number;
}

@Injectable()
export class ZonesService {
  private readonly logger = new Logger(ZonesService.name);
  private readonly game: GameConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.game = config.get<GameConfig>('game')!;
  }

  async getArea(request: ZoneAreaRequestDto): Promise<ZoneItemDto[]> {
    const rows: Array<{
      zoneid: string;
      owneruserid: string;
      username: string | null;
      color: string;
      area_m2: number;
      captured_at: Date | null;
      poly: string;
    }> = await this.dataSource.query(
      `SELECT t.id::text AS zoneid, t.owner_user_id::text AS owneruserid, u.username,
              t.color, t.area_m2, t.captured_at, ST_AsGeoJSON((d).geom) AS poly
         FROM game_territory t
         JOIN sys_user u ON u.id = t.owner_user_id
         CROSS JOIN LATERAL ST_Dump(t.geom) d
        WHERE t.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)`,
      [request.minLng, request.minLat, request.maxLng, request.maxLat],
    );
    return rows.map((r) => ZonesService.toZoneItem(r));
  }

  async getUserZones(userId: string): Promise<ZoneItemDto[]> {
    const rows: Array<{
      zoneid: string;
      owneruserid: string;
      username: string | null;
      color: string;
      area_m2: number;
      captured_at: Date | null;
      poly: string;
    }> = await this.dataSource.query(
      `SELECT t.id::text AS zoneid, t.owner_user_id::text AS owneruserid, u.username,
              t.color, t.area_m2, t.captured_at, ST_AsGeoJSON((d).geom) AS poly
         FROM game_territory t
         JOIN sys_user u ON u.id = t.owner_user_id
         CROSS JOIN LATERAL ST_Dump(t.geom) d
        WHERE t.owner_user_id = $1`,
      [userId],
    );
    return rows.map((r) => ZonesService.toZoneItem(r));
  }

  /** A single zone's polygon parts (used to broadcast ZoneUpdated after capture). */
  async getZoneItem(zoneId: string): Promise<ZoneItemDto[]> {
    const rows: Array<{
      zoneid: string;
      owneruserid: string;
      username: string | null;
      color: string;
      area_m2: number;
      captured_at: Date | null;
      poly: string;
    }> = await this.dataSource.query(
      `SELECT t.id::text AS zoneid, t.owner_user_id::text AS owneruserid, u.username,
              t.color, t.area_m2, t.captured_at, ST_AsGeoJSON((d).geom) AS poly
         FROM game_territory t
         JOIN sys_user u ON u.id = t.owner_user_id
         CROSS JOIN LATERAL ST_Dump(t.geom) d
        WHERE t.id = $1`,
      [zoneId],
    );
    return rows.map((r) => ZonesService.toZoneItem(r));
  }

  async getDetails(id: string): Promise<ZoneDetailsDto> {
    const rows: Array<{
      zoneid: string;
      owneruserid: string;
      username: string | null;
      avatar_file_id: string | null;
      area_m2: number;
      captured_at: Date | null;
    }> = await this.dataSource.query(
      `SELECT t.id::text AS zoneid, t.owner_user_id::text AS owneruserid,
              u.username, u.avatar_file_id, t.area_m2, t.captured_at
         FROM game_territory t
         JOIN sys_user u ON u.id = t.owner_user_id
        WHERE t.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Zone not found.');
    return {
      zoneId: r.zoneid,
      ownerUserId: r.owneruserid,
      ownerUsername: r.username,
      ownerAvatarUrl: r.avatar_file_id
        ? `/UserProfile/DownloadAvatar?fileId=${r.avatar_file_id}`
        : null,
      areaKm2: ZonesService.round(r.area_m2 / 1_000_000, 4),
      capturedAt: r.captured_at ? formatDateTime(new Date(r.captured_at)) : null,
    };
  }

  /** Recolor every zone owned by the user (called when the profile color changes). */
  async recolorUserZones(userId: string, color: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE game_territory SET color = $2 WHERE owner_user_id = $1`,
      [userId, color],
    );
  }

  /**
   * Capture territory from a completed run, applying all rules:
   *  - Rule 1: closed loop (start↔finish ≤ closeLoopDistance) → interior polygon.
   *  - Rule 4: full capture (run_km ≥ area_km² × ratio AND new fully covers old) → delete old.
   *  - Rule 2/3: overtake & cut (run_dist ≥ owner_dist × factor) → cut old (ST_Difference);
   *             otherwise the new zone is clipped so it cannot eat the protected zone.
   *  - Rule 5: merge with the same user's zones that touch or whose centroid is within
   *             mergeCentroid distance (ST_Union); also covers expansion (start inside own zone).
   * All writes run in one transaction.
   */
  async captureFromRun(session: CaptureSession): Promise<CaptureResult> {
    const points: PointRow[] = await this.dataSource.query(
      `SELECT latitude, longitude FROM game_location_point
        WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3
        ORDER BY recorded_at ASC`,
      [session.userId, session.startedAt, session.endedAt],
    );

    if (points.length < 3) return { closed: false, saved: false };

    const first = points[0];
    const last = points[points.length - 1];
    const gap = haversineDistance(first.latitude, first.longitude, last.latitude, last.longitude);
    if (gap > this.game.closeLoopDistanceM) return { closed: false, saved: false };

    // Closed ring WKT (append the first point to close it) + run distance (haversine sum).
    const ring = [...points, first];
    const wkt = `LINESTRING(${ring.map((p) => `${p.longitude} ${p.latitude}`).join(', ')})`;
    let runDistanceM = 0;
    for (let i = 1; i < points.length; i++) {
      runDistanceM += haversineDistance(
        points[i - 1].latitude, points[i - 1].longitude,
        points[i].latitude, points[i].longitude,
      );
    }

    const { overtakeFactor, captureDistanceRatio, minZoneAreaM2, mergeCentroidM } = this.game;
    const runDistanceKm = runDistanceM / 1000;
    const userId = session.userId;

    return this.dataSource.transaction(async (manager) => {
      // A) Build the new polygon from the closed ring.
      const built: Array<{ ewkt: string; empty: boolean }> = await manager.query(
        `SELECT ST_AsEWKT(g) AS ewkt, ST_IsEmpty(g) AS empty
           FROM (SELECT ${NORM('ST_MakePolygon(ST_GeomFromText($1, 4326))')} AS g) q`,
        [wkt],
      );
      if (!built[0] || built[0].empty) {
        this.logger.warn(`Invalid capture polygon for user ${userId}`);
        return { closed: true, saved: false };
      }
      let znew = built[0].ewkt;

      // B) Classify other users' overlapping zones.
      const others: Array<{
        id: string;
        run_distance_m: number;
        area_m2: number;
        fully_covered: boolean;
      }> = await manager.query(
        `SELECT id::text AS id, run_distance_m, ST_Area(geom::geography) AS area_m2,
                ST_CoveredBy(geom, ST_GeomFromEWKT($1)) AS fully_covered
           FROM game_territory
          WHERE owner_user_id <> $2
            AND geom && ST_GeomFromEWKT($1)
            AND ST_Intersects(geom, ST_GeomFromEWKT($1))`,
        [znew, userId],
      );

      const fullIds: string[] = [];
      const cutIds: string[] = [];
      const blockIds: string[] = [];
      for (const z of others) {
        const areaKm2 = Number(z.area_m2) / 1_000_000;
        if (z.fully_covered && runDistanceKm >= areaKm2 * captureDistanceRatio) {
          fullIds.push(z.id); // Rule 4
        } else if (runDistanceM >= Number(z.run_distance_m) * overtakeFactor) {
          cutIds.push(z.id); // Rule 2/3 — allowed to cut
        } else {
          blockIds.push(z.id); // protected — clip the new zone instead
        }
      }

      // C) Clip the new zone by protected (blocking) zones.
      if (blockIds.length > 0) {
        const clipped: Array<{ ewkt: string; empty: boolean }> = await manager.query(
          `SELECT ST_AsEWKT(g) AS ewkt, ST_IsEmpty(g) AS empty
             FROM (SELECT ${NORM(
               'ST_Difference(ST_GeomFromEWKT($1), (SELECT ST_Union(geom) FROM game_territory WHERE id = ANY($2::uuid[])))',
             )} AS g) q`,
          [znew, blockIds],
        );
        if (!clipped[0] || clipped[0].empty) {
          return { closed: true, saved: false }; // fully blocked, nothing left to claim
        }
        znew = clipped[0].ewkt;
      }

      // D) Rule 4 — fully captured zones are removed (their area is inside znew).
      if (fullIds.length > 0) {
        await manager.query(`DELETE FROM game_territory WHERE id = ANY($1::uuid[])`, [fullIds]);
      }

      // E) Rule 2/3 — cut the new zone out of cuttable zones; drop tiny remainders.
      if (cutIds.length > 0) {
        const rem: Array<{ id: string; rem_area: number | null }> = await manager.query(
          `SELECT id::text AS id, ST_Area(ST_Difference(geom, ST_GeomFromEWKT($1))::geography) AS rem_area
             FROM game_territory WHERE id = ANY($2::uuid[])`,
          [znew, cutIds],
        );
        const toDelete = rem
          .filter((r) => r.rem_area == null || Number(r.rem_area) < minZoneAreaM2)
          .map((r) => r.id);
        const toUpdate = rem.map((r) => r.id).filter((id) => !toDelete.includes(id));

        if (toUpdate.length > 0) {
          await manager.query(
            `UPDATE game_territory
                SET geom     = ${NORM('ST_Difference(geom, ST_GeomFromEWKT($1))')},
                    centroid = ST_Centroid(${NORM('ST_Difference(geom, ST_GeomFromEWKT($1))')}),
                    area_m2  = ST_Area((${NORM('ST_Difference(geom, ST_GeomFromEWKT($1))')})::geography)
              WHERE id = ANY($2::uuid[])`,
            [znew, toUpdate],
          );
        }
        if (toDelete.length > 0) {
          await manager.query(`DELETE FROM game_territory WHERE id = ANY($1::uuid[])`, [toDelete]);
        }
      }

      // F) Rule 5 — merge with the same user's touching / nearby-centroid zones.
      const neighbors: Array<{ id: string; run_distance_m: number }> = await manager.query(
        `SELECT id::text AS id, run_distance_m FROM game_territory
          WHERE owner_user_id = $2
            AND ( ST_Intersects(geom, ST_GeomFromEWKT($1))
               OR ST_DWithin(centroid::geography, ST_Centroid(ST_GeomFromEWKT($1))::geography, $3) )`,
        [znew, userId, mergeCentroidM],
      );

      let finalEwkt = znew;
      let runDist = runDistanceM;
      if (neighbors.length > 0) {
        const ids = neighbors.map((n) => n.id);
        runDist = Math.max(runDistanceM, ...neighbors.map((n) => Number(n.run_distance_m)));
        const merged: Array<{ ewkt: string }> = await manager.query(
          `SELECT ST_AsEWKT(${NORM(
            'ST_Union(ST_GeomFromEWKT($1), (SELECT ST_Union(geom) FROM game_territory WHERE id = ANY($2::uuid[])))',
          )}) AS ewkt`,
          [znew, ids],
        );
        finalEwkt = merged[0].ewkt;
        await manager.query(`DELETE FROM game_territory WHERE id = ANY($1::uuid[])`, [ids]);
      }

      // G) Insert the final zone.
      const inserted: Array<{ id: string; area_m2: number; lat: number; lng: number }> =
        await manager.query(
          `INSERT INTO game_territory (owner_user_id, color, geom, centroid, area_m2, run_distance_m)
           SELECT $2, COALESCE(u.color, $4), g.geom, ST_Centroid(g.geom),
                  ST_Area(g.geom::geography), $3
             FROM (SELECT ${NORM('ST_GeomFromEWKT($1)')} AS geom) g CROSS JOIN sys_user u
            WHERE u.id = $2 AND NOT ST_IsEmpty(g.geom)
           RETURNING id::text AS id, area_m2, ST_Y(centroid) AS lat, ST_X(centroid) AS lng`,
          [finalEwkt, userId, runDist, DEFAULT_COLOR],
        );

      const row = inserted[0];
      if (!row) return { closed: true, saved: false };

      return {
        closed: true,
        saved: true,
        zoneId: row.id,
        areaKm2: ZonesService.round(row.area_m2 / 1_000_000, 4),
        centroidLat: row.lat,
        centroidLng: row.lng,
      };
    });
  }

  private static toZoneItem(r: {
    zoneid: string;
    owneruserid: string;
    username: string | null;
    color: string;
    area_m2: number;
    captured_at: Date | null;
    poly: string;
  }): ZoneItemDto {
    return {
      zoneId: r.zoneid,
      ownerUserId: r.owneruserid,
      ownerUsername: r.username,
      color: r.color ?? DEFAULT_COLOR,
      areaKm2: ZonesService.round(r.area_m2 / 1_000_000, 4),
      capturedAt: r.captured_at ? formatDate(new Date(r.captured_at)) : null,
      pathPolygon: ZonesService.outerRing(r.poly),
    };
  }

  /** GeoJSON Polygon string → outer ring as [{lat,lng}]. */
  private static outerRing(geojson: string): LatLngDto[] {
    try {
      const g = JSON.parse(geojson) as { type: string; coordinates: number[][][] };
      const ring = g.coordinates?.[0] ?? [];
      return ring.map(([lng, lat]) => ({ lat, lng }));
    } catch {
      return [];
    }
  }

  private static round(v: number, d: number): number {
    const f = 10 ** d;
    return Math.round(v * f) / f;
  }
}
