// Faithful port of Zonic.Core/Helpers/GeohashHelper.cs (bit-identical to the original).

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export interface GeoBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export function decode(geohash: string): GeoBounds {
  let minLat = -90.0,
    maxLat = 90.0;
  let minLng = -180.0,
    maxLng = 180.0;
  let isLng = true;

  for (const c of geohash) {
    const charIndex = BASE32.indexOf(c);
    if (charIndex < 0) break;

    for (let bit = 4; bit >= 0; bit--) {
      if (isLng) {
        const mid = (minLng + maxLng) / 2;
        if (((charIndex >> bit) & 1) === 1) minLng = mid;
        else maxLng = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (((charIndex >> bit) & 1) === 1) minLat = mid;
        else maxLat = mid;
      }
      isLng = !isLng;
    }
  }

  return { minLat, minLng, maxLat, maxLng };
}

export function encode(latitude: number, longitude: number, precision: number): string {
  let minLat = -90.0,
    maxLat = 90.0;
  let minLng = -180.0,
    maxLng = 180.0;

  const result: string[] = new Array(precision);
  let bit = 0;
  let ch = 0;
  let isLng = true;
  let index = 0;

  while (index < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (longitude >= mid) {
        ch |= 1 << (4 - bit);
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (latitude >= mid) {
        ch |= 1 << (4 - bit);
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      result[index] = BASE32[ch];
      index++;
      bit = 0;
      ch = 0;
    }
  }

  return result.join('');
}

export function getPrefix(geohash: string, length: number): string {
  return geohash.length <= length ? geohash : geohash.substring(0, length);
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
