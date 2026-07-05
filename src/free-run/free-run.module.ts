import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FreeRun } from '../entities/free-run.entity';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { FreeRunService } from './free-run.service';
import { FreeRunController } from './free-run.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FreeRun]), AuthModule, WalletModule],
  controllers: [FreeRunController],
  providers: [FreeRunService],
})
export class FreeRunModule {}
