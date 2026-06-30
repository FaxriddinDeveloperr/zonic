import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

// Read-only over existing data + lazy achievement-unlock writes. Uses the global DataSource,
// so no TypeOrmModule.forFeature is needed here.
@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
