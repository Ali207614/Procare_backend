import { SapModule } from './sap/sap.module';
import { RentalPhoneDevicesModule } from './rental-phone-devices/rental-phone-devices.module';
import { RentalPhoneDevicesService } from './rental-phone-devices/rental-phone-devices.service';
import { RentalPhoneDevicesController } from './rental-phone-devices/rental-phone-devices.controller';
import { CouriersModule } from './couriers/couriers.module';
import { CouriersService } from './couriers/couriers.service';
import { UsersModule } from './users/users.module';
import { UsersController } from './users/users.controller';
import { NotificationModule } from './notification/notification.module';
import { NotificationService } from './notification/notification.service';
import { RepairOrdersModule } from './repair-orders/repair-orders.module';
import { RepairOrdersService } from './repair-orders/repair-orders.service';
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
import { KnexModule } from 'nestjs-knex';
import knexConfig from './config/knex.config';
import { RedisModule } from './common/redis/redis.module';
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
import { NotificationController } from './notification/notification.controller';
import { UsersService } from './users/users.service';
import { PermissionsService } from './permissions/permissions.service';
import { PermissionsController } from './permissions/permissions.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { SapService } from './sap/sap.service';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RepairPartsController } from './repair-parts/repair-parts.controller';
import { RepairPartsModule } from './repair-parts/repair-parts.module';
import { RepairPartsService } from 'src/repair-parts/repair-parts.service';
import { ConfigModule } from '@nestjs/config';
import { TemplatesController } from './templates/templates.controller';
import { TemplatesModule } from './templates/templates.module';
import { AuthController } from 'src/auth/auth.controller';
import { BranchesController } from 'src/branches/branches.controller';
import { CampaignsController } from './campaigns/campaigns.controller';
import { CampaignsModule } from './campaigns/campaigns.module';
import { TelegramModule } from './telegram/telegram.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    SapModule,
    ScheduleModule.forRoot(),
    RentalPhoneDevicesModule,
    CouriersModule,
    UsersModule,
    NotificationModule,
    RepairOrdersModule,
    RepairOrderStatusPermissionsModule,
    RepairOrderStatusTransitionsModule,
    RepairOrderStatusesModule,
    PhoneOsTypesModule,
    ProblemCategoriesModule,
    PhoneCategoriesModule,
    PermissionsModule,
    BranchesModule,
    RolesModule,
    FeatureModule,
    KnexModule.forRoot({ config: knexConfig }),
    RedisModule,
    LoggerModule,
    AuthModule,
    AdminsModule,
    RepairPartsModule,
    ConfigModule,
    TemplatesModule,
    CampaignsModule,
    TelegramModule,
  ],
  controllers: [
    AuthController,
    AdminsController,
    UsersController,
    BranchesController,
    RolesController,
    RepairOrderStatusesController,
    RentalPhoneDevicesController,
    RepairOrderStatusPermissionsController,
    ProblemCategoriesController,
    PhoneCategoriesController,
    RepairPartsController,
    NotificationController,
    PermissionsController,
    TemplatesController,
    CampaignsController,
  ],
  providers: [
    RepairPartsService,
    RepairOrdersService,
    RentalPhoneDevicesService,
    PermissionsService,
    CouriersService,
    NotificationService,
    RepairOrderStatusPermissionsService,
    RepairOrderStatusTransitionsService,
    RepairOrderStatusesService,
    PhoneOsTypesService,
    ProblemCategoriesService,
    PhoneCategoriesService,
    RolesService,
    AdminsService,
    SapService,
    UsersService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MaintenanceMiddleware).forRoutes('*');

    consumer.apply(RateLimiterByIpMiddleware).forRoutes(...PublicRoutes);

    consumer.apply(JwtMiddleware, RateLimiterMiddleware).forRoutes(...RateLimitedUserRoutes);

    consumer.apply(JwtMiddleware, RateLimiterMiddleware).forRoutes(...RateLimitedAdminRoutes);

    consumer.apply(LoggingMiddleware).forRoutes('*');

    // consumer
    //   .apply(VerifyRawBodyMiddleware, VerifyPaymeSignatureMiddleware)
    //   .forRoutes({ path: 'payments/payme/callback', method: RequestMethod.POST });

    // consumer
    //   .apply(VerifyClickSignatureMiddleware)
    //   .forRoutes({ path: 'payments/click/callback', method: RequestMethod.POST });
  }
}
