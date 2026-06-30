import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ClanService } from './clan.service';
import { ClanController } from './clan.controller';

@Module({
  imports: [AuthModule, SubscriptionModule],
  controllers: [ClanController],
  providers: [ClanService],
})
export class ClanModule {}
