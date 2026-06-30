import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';

@Module({
  imports: [AuthModule, WalletModule],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
