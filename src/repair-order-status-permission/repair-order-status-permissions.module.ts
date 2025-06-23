/*
https://docs.nestjs.com/modules
*/

import { forwardRef, Module } from '@nestjs/common';
import { BranchesModule } from 'src/branches/branches.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderStatusesModule } from 'src/repair-order-statuses/repair-order-statuses.module';
import { SapModule } from 'src/sap/sap.module';
import { RepairOrderStatusPermissionsController } from './repair-order-status-permissions.controller';
import { RepairOrderStatusPermissionsService } from './repair-order-status-permissions.service';

@Module({
    imports: [
        RedisModule,
        PermissionsModule,
        forwardRef(() => RepairOrderStatusesModule),
    ],
    controllers: [RepairOrderStatusPermissionsController],
    providers: [RepairOrderStatusPermissionsService],
    exports: [RepairOrderStatusPermissionsService]
})
export class RepairOrderStatusPermissionsModule { }
