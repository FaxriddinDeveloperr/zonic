import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';

// Read-only over existing tables via the global DataSource.
@Module({
  imports: [AuthModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
