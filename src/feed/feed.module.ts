import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';

@Module({
  imports: [AuthModule, FriendsModule, SubscriptionModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
