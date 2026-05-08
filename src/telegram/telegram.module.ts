import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
