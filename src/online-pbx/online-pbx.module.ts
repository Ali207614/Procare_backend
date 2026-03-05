import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OnlinePbxController } from './online-pbx.controller';
import { OnlinePbxService } from './online-pbx.service';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RepairOrdersModule } from 'src/repair-orders/repair-orders.module';

@Module({
  imports: [ConfigModule, LoggerModule, RepairOrdersModule],
  controllers: [OnlinePbxController],
  providers: [OnlinePbxService],
  exports: [OnlinePbxService],
})
export class OnlinePbxModule {}
