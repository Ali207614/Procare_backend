import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OnlinePbxController } from './online-pbx.controller';
import { OnlinePbxRecordingService } from './online-pbx-recording.service';
import { OnlinePbxService } from './online-pbx.service';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RepairOrdersModule } from 'src/repair-orders/repair-orders.module';
import { HistoryModule } from 'src/history/history.module';

@Module({
  imports: [ConfigModule, LoggerModule, RepairOrdersModule, HistoryModule],
  controllers: [OnlinePbxController],
  providers: [OnlinePbxService, OnlinePbxRecordingService],
  exports: [OnlinePbxService, OnlinePbxRecordingService],
})
export class OnlinePbxModule {}
