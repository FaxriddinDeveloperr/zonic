import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Zone } from './entities/zone.entity';
import { UserLocation } from './entities/user-location.entity';
import { LocationPoint } from './entities/location-point.entity';
import { RunSession } from './entities/run-session.entity';
import { FreeRun } from './entities/free-run.entity';
import { RunType } from './entities/run-type.entity';
import { State } from './entities/state.entity';
import { Country } from './entities/country.entity';
import { Region } from './entities/region.entity';
import { District } from './entities/district.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { StepActivity } from './entities/step-activity.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ZonesModule } from './zones/zones.module';
import { RunSessionModule } from './run-sessions/run-session.module';
import { FreeRunModule } from './free-run/free-run.module';
import { ManualModule } from './manual/manual.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StatsModule } from './stats/stats.module';
import { StepsModule } from './steps/steps.module';
import { ActivityModule } from './activity/activity.module';
import { WalletModule } from './wallet/wallet.module';
import { MarketModule } from './market/market.module';
import { FriendsModule } from './friends/friends.module';
import { ChallengesModule } from './challenges/challenges.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { PaymentModule } from './payment/payment.module';
import { FeedModule } from './feed/feed.module';
import { CoachModule } from './coach/coach.module';
import { ClanModule } from './clan/clan.module';

const ENTITIES = [
  User,
  RefreshToken,
  Zone,
  UserLocation,
  LocationPoint,
  RunSession,
  FreeRun,
  RunType,
  State,
  Country,
  Region,
  District,
  UserAchievement,
  StepActivity,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: ENTITIES,
        synchronize: false, // existing schema — never auto-alter
      }),
    }),
    AuthModule,
    UsersModule,
    ZonesModule,
    RunSessionModule,
    FreeRunModule,
    ManualModule,
    RealtimeModule,
    StatsModule,
    StepsModule,
    ActivityModule,
    WalletModule,
    MarketModule,
    FriendsModule,
    ChallengesModule,
    SubscriptionModule,
    PaymentModule,
    FeedModule,
    CoachModule,
    ClanModule,
  ],
})
export class AppModule {}
