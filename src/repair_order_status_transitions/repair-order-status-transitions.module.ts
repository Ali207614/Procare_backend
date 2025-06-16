import { RepairOrderStatusTransitionsController } from './repair-order-status-transitions.controller';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderStatusesModule } from 'src/repair-order-statuses/repair-order-statuses.module';
import { RepairOrderStatusTransitionsService } from './repair-order-status-transitions.service';

@Module({
    imports: [RedisModule, PermissionsModule, RepairOrderStatusesModule],
    controllers: [
        RepairOrderStatusTransitionsController,],
    providers: [RepairOrderStatusTransitionsService],
})
export class RepairOrderStatusTransitionsModule { }
