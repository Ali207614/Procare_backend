import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { SapQueueProcessor } from './sap.queue.processor';
import { SapService } from './sap.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [
    LoggerModule,
    BullModule.registerQueue({
      name: 'sap',
    }),
    RedisModule,
  ],
  providers: [SapService, SapQueueProcessor],
  exports: [SapService, BullModule],
})
export class SapModule {}
