import { Module } from "@nestjs/common";
import { BranchesModule } from "src/branches/branches.module";
import { RedisModule } from "src/common/redis/redis.module";
import { NotificationModule } from "src/notification/notification.module";
import { RepairOrderStatusPermissionsModule } from "src/repair-order-status-permission/repair-order-status-permissions.module";
import { AssignAdminUpdaterService } from "./services/assign-admin-updater.service";
import { CommentUpdaterService } from "./services/comment-updater.service";
import { DeliveryUpdaterService } from "./services/delivery-updater.service";
import { FinalProblemUpdaterService } from "./services/final-problem-updater.service";
import { InitialProblemUpdaterService } from "./services/initial-problem-updater.service";
import { PickupUpdaterService } from "./services/pickup-updater.service";
import { RepairOrderChangeLoggerService } from "./services/repair-order-change-logger.service";
import { RepairOrderCreateHelperService } from "./services/repair-order-create-helper.service";

@Module({
    imports: [RepairOrderStatusPermissionsModule, RedisModule, NotificationModule],
    providers: [
        AssignAdminUpdaterService,
        InitialProblemUpdaterService,
        FinalProblemUpdaterService,
        CommentUpdaterService,
        PickupUpdaterService,
        DeliveryUpdaterService,
        RepairOrderChangeLoggerService,
        RepairOrderCreateHelperService
    ],
    exports: [
        AssignAdminUpdaterService,
        InitialProblemUpdaterService,
        FinalProblemUpdaterService,
        CommentUpdaterService,
        PickupUpdaterService,
        DeliveryUpdaterService,
        RepairOrderChangeLoggerService,
        RepairOrderCreateHelperService
    ],
})
export class RepairOrdersModule { }
