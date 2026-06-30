// Subscription DTOs (Phase M).
import { ApiProperty } from '@nestjs/swagger';
import { TierFeatures } from '../../common/subscription-tiers';

export class TierPlanDto {
  @ApiProperty({ example: 'gold' })
  tier: string;

  @ApiProperty({ example: 'Gold' })
  title: string;

  @ApiProperty({ example: 15000, description: 'UZS per month' })
  pricePerMonthUzs: number;

  @ApiProperty({ description: 'Feature flags for this tier' })
  features: TierFeatures;
}

export class PlansResponseDto {
  @ApiProperty({ type: [TierPlanDto] })
  plans: TierPlanDto[];
}

export class MySubscriptionDto {
  @ApiProperty({ example: 'gold', description: 'Effective tier (free if expired)' })
  tier: string;

  @ApiProperty({
    example: '2026-07-30T00:00:00.000Z',
    nullable: true,
    description: 'Expiry (null for free)',
  })
  expiresAt: string | null;

  @ApiProperty({ description: 'Feature flags for the effective tier' })
  features: TierFeatures;
}
