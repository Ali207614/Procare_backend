// src/main.ts
import './config/env-loader';
import { webcrypto } from 'node:crypto';
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor, BadRequestException } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SanitizationPipe } from './common/pipe/sanitization.pipe';
import { extractError } from './common/utils/validation.util';
import { LoggerService } from './common/logger/logger.service';

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import type { Application as ExpressApp } from 'express';

// Bull v3 (bull)
import { getQueueToken as getBullToken } from '@nestjs/bull';
import { Queue as BullQueue } from 'bull';
import { BullAdapter } from '@bull-board/api/bullAdapter';

// BullMQ
import { Queue as BullMQQueue } from 'bullmq';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

// Bull Board UI
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new LoggerService();

  const GLOBAL_PREFIX = 'api/v1';
  const HOST = process.env.HOST || '127.0.0.1';
  const PORT = Number(process.env.PORT) || 5001;

  // CORS
  app.enableCors({ origin: '*', credentials: true });

  // Security & perf
  app.use(helmet());
  app.use(compression({ threshold: 1024 }));

  // Filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

  // Pipes
  app.useGlobalPipes(
    new SanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors): BadRequestException => {
        const { message, location } = extractError(errors);
        return new BadRequestException({
          message,
          error: 'ValidationError',
          location,
          timestamp: new Date().toISOString(),
          statusCode: 400,
        });
      },
    }),
  );

  // Prefix
  app.setGlobalPrefix(GLOBAL_PREFIX);

  // Basic auth: Queues & Swagger
  app.use(
    ['/admin/queues'],
    basicAuth({
      users: { [process.env.QUEUE_USER ?? 'admin']: process.env.QUEUE_PASS ?? 'admin' },
      challenge: true,
    }),
  );
  app.use(
    [`/${GLOBAL_PREFIX}/docs`],
    basicAuth({
      users: { [process.env.SWAGGER_USER || 'Admin']: process.env.SWAGGER_PASS || '1234' },
      challenge: true,
    }),
  );

  // Swagger
  const swaggerCfg = new DocumentBuilder()
    .setTitle('📱 Procare Admin API')
    .setDescription(
      `<b>Procare</b> is an online phone repair management platform.<br />
       This <b>Admin API</b> allows you to manage branches, repair orders, users, and related technical operations.`.trim(),
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
      description: 'Enter your JWT token: <code>Bearer &lt;token&gt;</code>',
    })
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, swaggerDoc);

  // -------- Bull Board wiring --------
  // 1) Bull (v3) queue — sap
  let sapQueue: BullQueue | undefined;
  try {
    sapQueue = app.get<BullQueue>(getBullToken('sap'));
  } catch {
    logger.warn('[BullBoard] sap Bull queue DI orqali topilmadi (optional).');
  }

  let campaignsQueue: BullMQQueue;
  try {
    campaignsQueue = app.get<BullMQQueue>('CAMPAIGNS_QUEUE');
  } catch {
    logger.warn('[BullBoard] CAMPAIGNS_QUEUE provider topilmadi. UI-only instansiya yaratamiz.');
    campaignsQueue = new BullMQQueue('campaigns', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    });
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queuesAdapters = [
    ...(sapQueue ? [new BullAdapter(sapQueue)] : []),
    new BullMQAdapter(campaignsQueue),
  ];

  createBullBoard({
    queues: queuesAdapters,
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // Start HTTP
  await app.listen(PORT, HOST);
  const expressApp = app.getHttpAdapter().getInstance() as ExpressApp;
  expressApp.set('trust proxy', 1);

  logger.log(`http://${HOST}:${PORT}/${GLOBAL_PREFIX}`);
  logger.log(`Swagger: http://${HOST}:${PORT}/${GLOBAL_PREFIX}/docs`);
  logger.log(`Queues: http://${HOST}:${PORT}/admin/queues`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap error:', err);
  process.exit(1);
});
