import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { LoggerModule } from "src/common/logger/logger.module";
import { RedisModule } from "src/common/redis/redis.module";
import { SapQueueProcessor } from "./sap.queue.processor";
import { SapService } from "./sap.service";


@Module({
    imports: [
        BullModule.registerQueue({
            name: 'sap',
        }),
        RedisModule,
        LoggerModule
    ],
    providers: [SapService, SapQueueProcessor],
    exports: [SapService, BullModule],
})
export class SapModule { }
