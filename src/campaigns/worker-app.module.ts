// src/worker/worker-app.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { CampaignsModule } from 'src/campaigns/campaigns.module';
import { KnexModule } from 'nestjs-knex';
import knexConfig from 'src/config/knex.config';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from 'src/telegram/telegram.module';
// Agar CampaignsModule ichida PermissionsModule ishlatilsa, bu yerda alohida import shart emas;
// CampaignsModule uni o‘zi import qilsa bas. Muhimi — Knex shu konteynerda ro‘yxatga olinishi.

@Module({
  imports: [
    // .env (global) – ixtiyoriy, lekin foydali
    ConfigModule.forRoot({ isGlobal: true }),

    // Redis/BullMQ connection
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        // password: process.env.REDIS_PASSWORD,
      },
    }),

    // ⚠️ MUHIM: Worker konteynerda ham Knex’ni ro‘yxatdan o‘tkazamiz
    KnexModule.forRoot({ config: knexConfig }),

    // Sizning umumiy modullar
    LoggerModule,
    RedisModule,
    TelegramModule,

    // Processor'ni ichida tutadigan modul
    CampaignsModule,
  ],
})
export class WorkerAppModule {}
