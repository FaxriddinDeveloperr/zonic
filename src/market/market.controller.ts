// Routes under /Market ([Authorize]).
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { MarketService } from './market.service';
import {
  MarketItemsResponseDto,
  PurchaseRequestDto,
  PurchaseResultDto,
} from './dto/market.dto';

@ApiTags('Market')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('Items')
  @ApiOperation({ summary: 'List active market items' })
  @ApiOkResponse({ type: MarketItemsResponseDto })
  items(): Promise<MarketItemsResponseDto> {
    return this.marketService.listItems();
  }

  @Post('Purchase')
  @HttpCode(200)
  @ApiOperation({ summary: 'Buy an item with Tanga (optionally spend XP for a discount)' })
  @ApiOkResponse({ type: PurchaseResultDto })
  purchase(
    @CurrentUser() user: AuthUser,
    @Body() dto: PurchaseRequestDto,
  ): Promise<PurchaseResultDto> {
    return this.marketService.purchase(user.userId, dto.itemCode, dto.useXp ?? 0);
  }
}
