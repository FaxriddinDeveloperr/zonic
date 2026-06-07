import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunSession } from '../entities/run-session.entity';
import { LocationPoint } from '../entities/location-point.entity';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { RunSessionService } from './run-session.service';
import { ProfileService } from '../profile/profile.service';
import { UserProfileController } from './user-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RunSession, LocationPoint, User]), AuthModule],
  controllers: [UserProfileController],
  providers: [RunSessionService, ProfileService],
  exports: [RunSessionService], // used by the realtime gateway (StartRun/StopRun)
})
export class RunSessionModule {}
