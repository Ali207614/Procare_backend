import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { NotificationModule } from 'src/notification/notification.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

@Module({
    imports: [RedisModule, PermissionsModule],
    controllers: [AdminsController],
    providers: [AdminsService],
    exports: [AdminsService, AdminsModule],
})
export class AdminsModule { }

