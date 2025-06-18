import { NotificationModule } from './notification/notification.module';
import { NotificationService } from './notification/notification.service';
import { RepairOrdersModule } from './repair-orders/repair-orders.module';
import { RepairOrdersService } from './repair-orders/repair-orders.service';
import { RepairOrdersController } from './repair-orders/repair-orders.controller';
import { RepairOrderStatusPermissionsModule } from './repair-order-status-permission/repair-order-status-permissions.module';
import { RepairOrderStatusPermissionsController } from './repair-order-status-permission/repair-order-status-permissions.controller';
import { RepairOrderStatusPermissionsService } from './repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderStatusTransitionsModule } from './repair_order_status_transitions/repair-order-status-transitions.module';
import { RepairOrderStatusTransitionsService } from './repair_order_status_transitions/repair-order-status-transitions.service';
import { RepairOrderStatusesModule } from './repair-order-statuses/repair-order-statuses.module';
import { RepairOrderStatusesService } from './repair-order-statuses/repair-order-statuses.service';
import { RepairOrderStatusesController } from './repair-order-statuses/repair-order-statuses.controller';
import { PhoneOsTypesModule } from './phone-os-types/phone-os-types.module';
import { PhoneOsTypesService } from './phone-os-types/phone-os-types.service';
import { PhoneProblemMappingsModule } from './phone-problem-mappings/phone-problem-mappings.module';
import { PhoneProblemMappingsService } from './phone-problem-mappings/phone-problem-mappings.service';
import { PhoneProblemMappingsController } from './phone-problem-mappings/phone-problem-mappings.controller';
import { ProblemCategoriesModule } from './problem-categories/problem-categories.module';
import { ProblemCategoriesService } from './problem-categories/problem-categories.service';
import { ProblemCategoriesController } from './problem-categories/problem-categories.controller';
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
import { PhoneCategoriesController } from './phone-categories/phone-categories.controller';


@Module({
  imports: [
    NotificationModule,
    RepairOrdersModule,
    RepairOrderStatusPermissionsModule,
    RepairOrderStatusTransitionsModule,
    RepairOrderStatusesModule,
    PhoneOsTypesModule,
    PhoneProblemMappingsModule,
    ProblemCategoriesModule,
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
    RepairOrdersController,
    RepairOrderStatusPermissionsController,
    RepairOrderStatusesController,
    PhoneProblemMappingsController,
    ProblemCategoriesController,
    PhoneCategoriesController,
    RolesController,
    AdminsController,
  ],
  providers: [
    NotificationService,
    RepairOrdersService,
    RepairOrderStatusPermissionsService,
    RepairOrderStatusTransitionsService,
    RepairOrderStatusesService,
    PhoneOsTypesService,
    PhoneProblemMappingsService,
    ProblemCategoriesService,
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

