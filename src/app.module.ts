import { AdminsModule } from './admins/admins.module';
import { AdminsController } from './admins/admins.controller';
import { AdminsService } from './admins/admins.service';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnexModule } from 'nestjs-knex';
import knexConfig from './config/knex.config';
import { RedisModule } from './common/redis/redis.module';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './auth/auth.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { RateLimitedAdminRoutes } from './config/admin-rate-limited.routes';
import { RateLimiterAdminMiddleware } from './common/middleware/rate-limiter-by-admin.middleware';
import { JwtAdminMiddleware } from './common/middleware/jwt-admin.middleware';
import { JwtUserMiddleware } from './common/middleware/jwt-user.middleware';
import { RateLimitedUserRoutes } from './config/user-rate-limited.routes';
import { RateLimiterByUserMiddleware } from './common/middleware/rate-limiter-by-user.middleware';
import { PublicRoutes } from './config/public.routes';
import { RateLimiterByIpMiddleware } from './common/middleware/rate-limiter-by-ip.middleware';
import { MaintenanceMiddleware } from './common/middleware/maintenance.middleware';
import { FeatureModule } from './feature/feature.module';


@Module({
  imports: [
    FeatureModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'docker'
        ? ['.env.docker', '.env']
        : ['.env.local', '.env'],
    }),
    KnexModule.forRoot({ config: knexConfig }),
    RedisModule,
    LoggerModule,
    AuthModule,
    AdminsModule,
  ],
  controllers: [
    AdminsController,
  ],
  providers: [
    AdminsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {

    consumer
      .apply(MaintenanceMiddleware).forRoutes('*');

    consumer
      .apply(RateLimiterByIpMiddleware)
      .forRoutes(...PublicRoutes);

    consumer
      .apply(JwtUserMiddleware, RateLimiterByUserMiddleware)
      .forRoutes(...RateLimitedUserRoutes);

    consumer
      .apply(JwtAdminMiddleware, RateLimiterAdminMiddleware)
      .forRoutes(...RateLimitedAdminRoutes);

    consumer
      .apply(LoggingMiddleware).forRoutes('*');


    // consumer
    //   .apply(VerifyRawBodyMiddleware, VerifyPaymeSignatureMiddleware)
    //   .forRoutes({ path: 'payments/payme/callback', method: RequestMethod.POST });

    // consumer
    //   .apply(VerifyClickSignatureMiddleware)
    //   .forRoutes({ path: 'payments/click/callback', method: RequestMethod.POST });
  }
}

