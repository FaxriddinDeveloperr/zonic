import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StepActivity } from '../entities/step-activity.entity';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { StepsService } from './steps.service';
import { StepsController } from './steps.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StepActivity, User]), AuthModule, WalletModule],
  controllers: [StepsController],
  providers: [StepsService],
})
export class StepsModule {}
