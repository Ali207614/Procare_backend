import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OnlinePbxController } from './online-pbx.controller';
import { OnlinePbxService } from './online-pbx.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [ConfigModule, LoggerModule],
  controllers: [OnlinePbxController],
  providers: [OnlinePbxService],
  exports: [OnlinePbxService],
})
export class OnlinePbxModule {}
