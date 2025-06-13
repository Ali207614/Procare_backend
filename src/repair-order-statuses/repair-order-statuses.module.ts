import { Module } from '@nestjs/common';
import { RepairOrderStatusesService } from './repair-order-statuses.service';
import { RepairOrderStatusesController } from './repair-order-statuses.controller';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
    imports: [RedisModule, PermissionsModule],
    controllers: [RepairOrderStatusesController],
    providers: [RepairOrderStatusesService],
})
export class RepairOrderStatusesModule { }