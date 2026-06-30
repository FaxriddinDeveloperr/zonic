// Steps / pedometer persistence + history (Phase E).
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StepActivity } from '../entities/step-activity.entity';
import { formatIso, parseFlexibleDateTime } from '../common/helpers/datetime';
import { badRequest } from '../common/validation-problem';
import { SaveStepsDto } from './dto/save-steps.dto';
import { StepActivityItemDto, StepsHistoryResponseDto } from './dto/steps-response.dto';

@Injectable()
export class StepsService {
  constructor(
    @InjectRepository(StepActivity) private readonly steps: Repository<StepActivity>,
  ) {}

  async save(userId: string, dto: SaveStepsDto): Promise<{ id: string }> {
    const startedAt = parseFlexibleDateTime(dto.startTime);
    const endedAt = parseFlexibleDateTime(dto.endTime);
    if (!startedAt) throw badRequest(['startTime is not a valid date.']);
    if (!endedAt) throw badRequest(['endTime is not a valid date.']);

    const saved = await this.steps.save(
      this.steps.create({
        userId,
        startedAt,
        endedAt,
        durationSeconds: dto.durationSeconds,
        steps: dto.steps,
        distanceKm: dto.distanceKm ?? 0,
      }),
    );
    return { id: saved.id };
  }

  async getHistory(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<StepsHistoryResponseDto> {
    const rows = await this.steps.find({
      where: { userId },
      order: { startedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: rows.map(StepsService.toItem) };
  }

  private static toItem(r: StepActivity): StepActivityItemDto {
    return {
      id: r.id,
      startTime: formatIso(new Date(r.startedAt)),
      endTime: formatIso(new Date(r.endedAt)),
      durationSeconds: r.durationSeconds,
      steps: r.steps,
      distanceKm: r.distanceKm,
    };
  }
}
