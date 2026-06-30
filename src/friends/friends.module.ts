import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';

@Module({
  imports: [AuthModule],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
