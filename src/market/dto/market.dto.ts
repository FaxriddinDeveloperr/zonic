// Market catalogue + purchase (Phase K).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MarketItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'frame_gold' })
  code: string;

  @ApiProperty({ example: 'Oltin Ramka', description: 'Display name' })
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ example: 5000, description: 'Price in the item currency' })
  price: number;

  @ApiProperty({ example: 'tanga', description: "'tanga' | 'uzs'" })
  currency: string;

  @ApiProperty({ nullable: true, example: 'frame', description: 'frame|theme|booster|challenge|premium|cosmetic|utility' })
  category: string | null;

  @ApiProperty({ example: false })
  isPremium: boolean;

  @ApiProperty({ example: 'permanent', description: 'permanent|1h|1d|1m|3m' })
  duration: string;

  @ApiProperty({ nullable: true, example: '-20%' })
  discountLabel: string | null;
}

export class MarketItemsResponseDto {
  @ApiProperty({ type: [MarketItemDto] })
  items: MarketItemDto[];
}

export class InventoryItemDto {
  @ApiProperty({ example: 'frame_gold' })
  code: string;

  @ApiProperty({ example: 'Oltin Ramka' })
  name: string;

  @ApiProperty({ nullable: true, example: 'frame' })
  category: string | null;

  @ApiProperty({ example: '2026-07-01T10:00:00.000Z' })
  purchasedAt: string;

  @ApiProperty({ nullable: true, example: '2026-08-01T10:00:00.000Z', description: 'null = permanent' })
  expiresAt: string | null;
}

export class InventoryResponseDto {
  @ApiProperty({ type: [InventoryItemDto] })
  items: InventoryItemDto[];
}

export class PurchaseRequestDto {
  @ApiProperty({ example: 'color_neon_pack', description: 'Market item code' })
  @IsString()
  itemCode: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'XP to spend for a discount (capped at what is needed/available)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  useXp?: number;
}

export class PurchaseResultDto {
  @ApiProperty()
  purchaseId: string;

  @ApiProperty({ example: 4000, description: 'Tanga actually paid (after XP discount)' })
  pricePaid: number;

  @ApiProperty({ example: 1000, description: 'XP spent on the discount' })
  xpSpent: number;

  @ApiProperty({ example: 8500, description: 'Remaining Tanga balance' })
  tanga: number;

  @ApiProperty({ example: 8000, description: 'Remaining XP balance' })
  xp: number;
}
