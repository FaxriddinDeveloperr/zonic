import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunSession } from '../entities/run-session.entity';
import { LocationPoint } from '../entities/location-point.entity';
import { AuthModule } from '../auth/auth.module';
import { RunSessionService } from './run-session.service';
import { UserProfileController } from './user-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RunSession, LocationPoint]), AuthModule],
  controllers: [UserProfileController],
  providers: [RunSessionService],
  exports: [RunSessionService], // used by the realtime gateway (StartRun/StopRun)
})
export class RunSessionModule {}
