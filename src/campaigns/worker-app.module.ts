import { Module } from '@nestjs/common';
import { KnexModule } from 'nestjs-knex';
import knexConfig from 'src/config/knex.config';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { CampaignsJobHandler } from 'src/campaigns/campaigns.job-handler';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KnexModule.forRoot({ config: knexConfig }),
    LoggerModule,
    RedisModule,
    TelegramModule,
  ],
  providers: [CampaignsJobHandler],
  exports: [CampaignsJobHandler],
})
export class WorkerAppModule {}
