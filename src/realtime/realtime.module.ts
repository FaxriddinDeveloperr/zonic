import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RunSessionModule } from '../run-sessions/run-session.module';
import { LocationChannel } from './location.channel';
import { LocationGateway } from './location.gateway';
import { LocationBackgroundService } from './location-background.service';

@Module({
  imports: [AuthModule, RunSessionModule],
  providers: [LocationChannel, LocationGateway, LocationBackgroundService],
})
export class RealtimeModule {}
