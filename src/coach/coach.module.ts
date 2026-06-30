import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';

@Module({
  imports: [AuthModule, SubscriptionModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
