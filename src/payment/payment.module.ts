import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [AuthModule, SubscriptionModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
