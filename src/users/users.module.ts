import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { ZonesModule } from '../zones/zones.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule, ZonesModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
