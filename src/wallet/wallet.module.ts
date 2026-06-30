import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

// Raw SQL over game_user_wallet + activity tables via the global DataSource.
@Module({
  imports: [AuthModule, SubscriptionModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
