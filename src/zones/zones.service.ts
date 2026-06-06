// Port of Zonic.ServiceLayer/Game/ZoneServices/ZoneService.cs
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from '../entities/zone.entity';
import { decode, encode } from '../common/helpers/geohash';
import { formatDate } from '../common/helpers/datetime';
import { ZoneAreaRequestDto } from './dto/zone-area-request.dto';
import { ZoneDto } from './dto/zone.dto';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
    private readonly config: ConfigService,
  ) {}

  async getArea(request: ZoneAreaRequestDto): Promise<ZoneDto[]> {
    const prefixes = this.getCoveringPrefixes(
      request.minLat,
      request.minLng,
      request.maxLat,
      request.maxLng,
    );
    if (prefixes.length === 0) return [];

    const qb = this.zones
      .createQueryBuilder('z')
      .leftJoinAndSelect('z.ownerUser', 'u');

    // z.Geohash.StartsWith(p) for any prefix → LIKE 'p%'
    const params: Record<string, string> = {};
    const conditions = prefixes
      .map((p, i) => {
        params[`p${i}`] = `${p}%`;
        return `z.geohash LIKE :p${i}`;
      })
      .join(' OR ');
    qb.where(`(${conditions})`, params);

    const zones = await qb.getMany();
    return zones.map((z) => ZonesService.toZoneDto(z));
  }

  async getUserZones(userId: string): Promise<ZoneDto[]> {
    const zones = await this.zones.find({
      where: { ownerUserId: userId },
      relations: { ownerUser: true },
    });
    return zones.map((z) => ZonesService.toZoneDto(z));
  }

  private static toZoneDto(z: Zone): ZoneDto {
    const bounds = decode(z.geohash);
    return {
      id: z.id,
      geohash: z.geohash,
      ownerUserId: z.ownerUserId,
      ownerUsername: z.ownerUser?.username ?? null,
      // Global Newtonsoft DateFormatString = "dd.MM.yyyy" → date-only string.
      capturedAt: z.capturedAt ? formatDate(new Date(z.capturedAt)) : null,
      minLat: bounds.minLat,
      minLng: bounds.minLng,
      maxLat: bounds.maxLat,
      maxLng: bounds.maxLng,
    };
  }

  private getCoveringPrefixes(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
  ): string[] {
    const precision = this.config.get<number>('game.groupPrecision')!;
    const prefixes = new Set<string>();

    const steps = 4;
    const latStep = (maxLat - minLat) / steps;
    const lngStep = (maxLng - minLng) / steps;

    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const lat = minLat + latStep * i;
        const lng = minLng + lngStep * j;
        prefixes.add(encode(lat, lng, precision));
      }
    }

    return [...prefixes];
  }
}
