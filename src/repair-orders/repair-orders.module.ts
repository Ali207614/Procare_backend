import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { BranchesModule } from "src/branches/branches.module";
import { RedisModule } from "src/common/redis/redis.module";
import { NotificationGateway } from "src/notification/notification.gateway";
import { NotificationModule } from "src/notification/notification.module";
import { RepairOrderStatusPermissionsModule } from "src/repair-order-status-permission/repair-order-status-permissions.module";
import { RepairOrderStatusesModule } from "src/repair-order-statuses/repair-order-statuses.module";
import { SapModule } from "src/sap/sap.module";
import { AssignAdminController } from "./controllers/assign-admin.controller";
import { CommentController } from "./controllers/comment.controller";
import { DeliveryController } from "./controllers/delivery.controller";
import { PickupController } from "./controllers/pickup.controller";
import { RentalPhoneController } from "./controllers/rental-phone.controller";
import { RepairOrdersController } from "./repair-orders.controller";
import { RepairOrdersService } from "./repair-orders.service";
import { AssignAdminUpdaterService } from "./services/assign-admin-updater.service";
import { CommentUpdaterService } from "./services/comment-updater.service";
import { DeliveryUpdaterService } from "./services/delivery-updater.service";
import { FinalProblemUpdaterService } from "./services/final-problem-updater.service";
import { InitialProblemUpdaterService } from "./services/initial-problem-updater.service";
import { PickupUpdaterService } from "./services/pickup-updater.service";
import { RentalPhoneUpdaterService } from "./services/rental-phone-updater.service";
import { RepairOrderChangeLoggerService } from "./services/repair-order-change-logger.service";
import { RepairOrderCreateHelperService } from "./services/repair-order-create-helper.service";

@Module({
    imports: [
        SapModule,
        RepairOrderStatusPermissionsModule,
        RedisModule,
        NotificationModule,
        RepairOrderStatusesModule,
    ],
    controllers: [
        RepairOrdersController,
        AssignAdminController,
        CommentController,
        DeliveryController,
        PickupController,
        RentalPhoneController,
    ],
    providers: [
        AssignAdminUpdaterService,
        InitialProblemUpdaterService,
        FinalProblemUpdaterService,
        CommentUpdaterService,
        PickupUpdaterService,
        DeliveryUpdaterService,
        RepairOrderChangeLoggerService,
        RepairOrderCreateHelperService,
        RentalPhoneUpdaterService,
        NotificationGateway,
        RepairOrdersService
    ],
    exports: [
        AssignAdminUpdaterService,
        InitialProblemUpdaterService,
        FinalProblemUpdaterService,
        CommentUpdaterService,
        PickupUpdaterService,
        DeliveryUpdaterService,
        RepairOrderChangeLoggerService,
        RepairOrderCreateHelperService,
        RentalPhoneUpdaterService,
    ],
})
export class RepairOrdersModule { }
