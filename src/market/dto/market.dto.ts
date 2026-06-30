// Market catalogue + purchase (Phase K).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MarketItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'color_neon_pack' })
  code: string;

  @ApiProperty({ example: 'Neon Color Pack' })
  title: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ example: 5000, description: 'Price in Tanga' })
  priceTanga: number;

  @ApiProperty({ nullable: true, example: 'cosmetic' })
  category: string | null;
}

export class MarketItemsResponseDto {
  @ApiProperty({ type: [MarketItemDto] })
  items: MarketItemDto[];
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
