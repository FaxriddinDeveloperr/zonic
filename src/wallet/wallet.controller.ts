// Routes under /Wallet ([Authorize]).
import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { WalletService } from './wallet.service';
import { WalletDto, DailyRewardDto } from './dto/wallet.dto';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('Wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Current Tanga + XP balance (expired XP zeroed lazily)' })
  @ApiOkResponse({ type: WalletDto })
  getWallet(@CurrentUser() user: AuthUser): Promise<WalletDto> {
    return this.walletService.getWallet(user.userId);
  }

  @Post('ClaimDailyReward')
  @HttpCode(200)
  @ApiOperation({ summary: 'Convert activity since the last claim into Tanga + XP' })
  @ApiOkResponse({ type: DailyRewardDto })
  claimDailyReward(@CurrentUser() user: AuthUser): Promise<DailyRewardDto> {
    return this.walletService.claimDailyReward(user.userId);
  }
}
