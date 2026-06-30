import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';

@Module({
  imports: [AuthModule, FriendsModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
})
export class ChallengesModule {}
