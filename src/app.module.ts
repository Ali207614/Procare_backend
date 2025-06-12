import { PhoneCategoriesModule } from './phone-categories/phone-categories.module';
import { PhoneCategoriesService } from './phone-categories/phone-categories.service';
import { BranchesModule } from './branches/branches.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';
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
import { RateLimitedUserRoutes } from './config/user-rate-limited.routes';
import { PublicRoutes } from './config/public.routes';
import { RateLimiterByIpMiddleware } from './common/middleware/rate-limiter-by-ip.middleware';
import { MaintenanceMiddleware } from './common/middleware/maintenance.middleware';
import { FeatureModule } from './feature/feature.module';
import { JwtMiddleware } from './common/middleware/jwt.middleware';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware';
import { PermissionsService } from './permissions/permissions.service';
import { APP_GUARD } from '@nestjs/core';
import { PermissionsGuard } from './common/guards/permission.guard';


@Module({
  imports: [
    PhoneCategoriesModule,
    PermissionsModule,
    BranchesModule,
    RolesModule,
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
    RolesController,
    AdminsController,
  ],
  providers: [
    PhoneCategoriesService,
    RolesService,
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
      .apply(JwtMiddleware, RateLimiterMiddleware)
      .forRoutes(...RateLimitedUserRoutes);

    consumer
      .apply(JwtMiddleware, RateLimiterMiddleware)
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

