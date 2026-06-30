// Unified Activity History (Phase F). Pulls the user's running (game_free_run), territory
// (game_territory) and steps (game_step_activity) records, normalises them to one card shape,
// sorts by time desc and paginates in memory (a single user's own history is small).
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { formatDate, formatHourMinute } from '../common/helpers/datetime';
import { haversineDistance } from '../common/helpers/geohash';
import {
  ActivityHistoryResponseDto,
  ActivityItemDto,
  ActivityType,
  LatLng,
} from './dto/activity-history.dto';

interface PrivacyZone {
  lat: number;
  lng: number;
  radius: number;
}

const round = (v: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

interface Internal extends ActivityItemDto {
  _ts: number; // sort key
}

@Injectable()
export class ActivityService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getHistory(
    userId: string,
    type: ActivityType,
    page: number,
    pageSize: number,
  ): Promise<ActivityHistoryResponseDto> {
    const want = (t: ActivityType): boolean => type === ActivityType.All || type === t;
    const all: Internal[] = [];

    const privacy = await this.loadPrivacyZone(userId);
    if (want(ActivityType.Running)) all.push(...(await this.running(userId, privacy)));
    if (want(ActivityType.Territory)) all.push(...(await this.territory(userId)));
    if (want(ActivityType.Steps)) all.push(...(await this.steps(userId)));

    all.sort((a, b) => b._ts - a._ts);
    const totalCount = all.length;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize).map(({ _ts, ...rest }) => rest);
    return { totalCount, page, pageSize, items };
  }

  private async loadPrivacyZone(userId: string): Promise<PrivacyZone | null> {
    const [u] = await this.dataSource.query(
      `SELECT privacy_lat, privacy_lng, privacy_radius_m FROM sys_user WHERE id = $1`,
      [userId],
    );
    if (u?.privacy_lat == null || u?.privacy_lng == null || !u?.privacy_radius_m) return null;
    return { lat: Number(u.privacy_lat), lng: Number(u.privacy_lng), radius: Number(u.privacy_radius_m) };
  }

  private async running(userId: string, privacy: PrivacyZone | null): Promise<Internal[]> {
    const rows: Array<{
      id: string;
      started_at: Date;
      duration_seconds: number;
      distance_km: number;
      route_points: Array<{ lat: number; lng: number }> | null;
    }> = await this.dataSource.query(
      `SELECT id::text, started_at, duration_seconds, distance_km, route_points
         FROM game_free_run WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r) => {
      const d = new Date(r.started_at);
      let polyline: LatLng[] = (r.route_points ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
      // Privacy zone: drop route points within the user's home radius before sharing the map.
      if (privacy) {
        polyline = polyline.filter(
          (p) => haversineDistance(p.lat, p.lng, privacy.lat, privacy.lng) > privacy.radius,
        );
      }
      return {
        _ts: d.getTime(),
        type: 'running',
        id: r.id,
        date: formatDate(d),
        time: formatHourMinute(d),
        durationSeconds: Number(r.duration_seconds),
        value: round(Number(r.distance_km), 2),
        unit: 'km',
        polyline,
        polygons: null,
      };
    });
  }

  private async territory(userId: string): Promise<Internal[]> {
    const rows: Array<{
      id: string;
      captured_at: Date;
      area_m2: number;
      geo: string;
    }> = await this.dataSource.query(
      `SELECT id::text, captured_at, area_m2, ST_AsGeoJSON(geom) AS geo
         FROM game_territory WHERE owner_user_id = $1`,
      [userId],
    );
    return rows.map((r) => {
      const d = new Date(r.captured_at);
      return {
        _ts: d.getTime(),
        type: 'territory',
        id: r.id,
        date: formatDate(d),
        time: formatHourMinute(d),
        durationSeconds: 0,
        value: round(Number(r.area_m2) / 1_000_000, 4),
        unit: 'km²',
        polyline: null,
        polygons: ActivityService.multiPolygonRings(r.geo),
      };
    });
  }

  private async steps(userId: string): Promise<Internal[]> {
    const rows: Array<{
      id: string;
      started_at: Date;
      duration_seconds: number;
      steps: number;
    }> = await this.dataSource.query(
      `SELECT id::text, started_at, duration_seconds, steps
         FROM game_step_activity WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r) => {
      const d = new Date(r.started_at);
      return {
        _ts: d.getTime(),
        type: 'steps',
        id: r.id,
        date: formatDate(d),
        time: formatHourMinute(d),
        durationSeconds: Number(r.duration_seconds),
        value: Number(r.steps),
        unit: 'steps',
        polyline: null,
        polygons: null,
      };
    });
  }

  /** GeoJSON (Multi)Polygon → outer ring of each polygon part as [{lat,lng}][]. */
  private static multiPolygonRings(geojson: string): LatLng[][] {
    try {
      const g = JSON.parse(geojson) as { type: string; coordinates: number[][][] | number[][][][] };
      const toRing = (ring: number[][]): LatLng[] => ring.map(([lng, lat]) => ({ lat, lng }));
      if (g.type === 'Polygon') {
        const coords = g.coordinates as number[][][];
        return coords[0] ? [toRing(coords[0])] : [];
      }
      // MultiPolygon
      const coords = g.coordinates as number[][][][];
      return coords.map((poly) => toRing(poly[0] ?? []));
    } catch {
      return [];
    }
  }
}
