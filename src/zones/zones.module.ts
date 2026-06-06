import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Zone } from '../entities/zone.entity';
import { AuthModule } from '../auth/auth.module';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Zone]), AuthModule],
  controllers: [ZonesController],
  providers: [ZonesService],
})
export class ZonesModule {}
