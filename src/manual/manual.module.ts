import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { State } from '../entities/state.entity';
import { Country } from '../entities/country.entity';
import { Region } from '../entities/region.entity';
import { District } from '../entities/district.entity';
import { RunType } from '../entities/run-type.entity';
import { AuthModule } from '../auth/auth.module';
import { ManualController } from './manual.controller';
import { ManualService } from './manual.service';

@Module({
  imports: [TypeOrmModule.forFeature([State, Country, Region, District, RunType]), AuthModule],
  controllers: [ManualController],
  providers: [ManualService],
})
export class ManualModule {}
