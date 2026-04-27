// src/main.ts
import { webcrypto } from 'node:crypto';
import './config/env-loader';

declare const globalThis: { crypto?: typeof webcrypto };
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

import { BadRequestException, ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggerService } from './common/logger/logger.service';
import { SanitizationPipe } from './common/pipe/sanitization.pipe';
import { extractError } from './common/utils/validation.util';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OperationObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { Application as ExpressApp } from 'express';
import basicAuth from 'express-basic-auth';

// BullMQ
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue as BullMQQueue } from 'bullmq';

// Bull Board UI
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new LoggerService();

  const GLOBAL_PREFIX = 'api/v1';
  const HOST = process.env.HOST || '0.0.0.0';
  const PORT = Number(process.env.PORT) || 5001;

  // CORS
  app.enableCors({ origin: '*', credentials: true });

  // Security & perf
  const expressApp = app.getHttpAdapter().getInstance() as ExpressApp;
  expressApp.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(compression({ threshold: 1024 }));

  // Filters & interceptors
  app.enableShutdownHooks();
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
  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: ['api/webhooks/(.*)'],
  });

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
    .addBasicAuth()
    .addTag(
      'Realtime Notifications',
      'Socket.IO handshake and notification event contract for admin realtime updates.',
    )
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerCfg);

  const socketIoOperation: OperationObject & Record<string, unknown> = {
    tags: ['Realtime Notifications'],
    summary: 'Socket.IO handshake for admin notifications',
    description:
      'This backend exposes realtime notifications through Socket.IO.\n\n' +
      'The server reads `adminId` from the handshake query string and automatically joins the connected admin to their branch rooms.\n\n' +
      'Important:\n' +
      '- This is not a REST endpoint and should not be called with Swagger UI `Try it out` as a normal HTTP API.\n' +
      '- This is not a path like `/adminId=...`; `adminId` must be sent as a query parameter.\n' +
      '- Frontend clients should use `socket.io-client` rather than a raw WebSocket client.\n\n' +
      'Frontend example:\n' +
      '```ts\n' +
      'import { io } from "socket.io-client";\n\n' +
      'const socket = io("https://crm-api.procare.uz", {\n' +
      '  query: {\n' +
      '    adminId: "00000000-0000-4000-8000-000000000001",\n' +
      '  },\n' +
      '});\n' +
      '```\n\n' +
      'Local low-level WebSocket testing may look like `ws://localhost:5001/?adminId=...`, but the production browser/client integration should target the API origin and let Socket.IO negotiate `/socket.io/` internally.',
    parameters: [
      {
        name: 'adminId',
        in: 'query',
        required: true,
        description: 'Admin UUID used during the Socket.IO handshake.',
        schema: {
          type: 'string',
          format: 'uuid',
          example: '00000000-0000-4000-8000-000000000001',
        },
      },
      {
        name: 'EIO',
        in: 'query',
        required: false,
        description:
          'Socket.IO engine version. Usually managed automatically by the Socket.IO client.',
        schema: {
          type: 'string',
          example: '4',
        },
      },
      {
        name: 'transport',
        in: 'query',
        required: false,
        description: 'Socket.IO transport. Usually managed automatically by the Socket.IO client.',
        schema: {
          type: 'string',
          enum: ['polling', 'websocket'],
          example: 'websocket',
        },
      },
      {
        name: 'sid',
        in: 'query',
        required: false,
        description:
          'Socket.IO session id for upgraded connections. Usually managed automatically by the Socket.IO client.',
        schema: {
          type: 'string',
          example: 'Jd9xQ0M4xQj2lY2PAAAA',
        },
      },
    ],
    responses: {
      '101': {
        description:
          'Protocol upgrade to WebSocket during a successful Socket.IO websocket handshake.',
      },
      '200': {
        description:
          'Initial Socket.IO polling handshake response when long-polling is used before websocket upgrade.',
        content: {
          'application/json': {
            examples: {
              pollingHandshake: {
                summary: 'Typical polling handshake payload',
                value: {
                  sid: 'Jd9xQ0M4xQj2lY2PAAAA',
                  upgrades: ['websocket'],
                  pingInterval: 25000,
                  pingTimeout: 20000,
                  maxPayload: 1000000,
                },
              },
            },
          },
        },
      },
    },
    'x-socketio-events': {
      emits: [],
      listens: [
        {
          event: 'notification',
          payload: {
            type: 'object',
            properties: {
              title: { type: 'string', example: 'New repair order' },
              message: {
                type: 'string',
                example: 'A new repair order was created in your branch.',
              },
              type: {
                type: 'string',
                enum: ['info', 'success', 'warning', 'error'],
                example: 'info',
              },
              meta: {
                type: 'object',
                properties: {
                  order_id: {
                    type: 'string',
                    format: 'uuid',
                    example: '11111111-1111-4111-8111-111111111111',
                  },
                  number_id: { type: 'string', example: '1024' },
                  sort: { type: 'number', example: 1 },
                  phone_category_name: {
                    type: 'string',
                    nullable: true,
                    example: 'iPhone 14 Pro',
                  },
                  user_full_name: {
                    type: 'string',
                    nullable: true,
                    example: 'Ali Valiyev',
                  },
                  user_phone_number: {
                    type: 'string',
                    nullable: true,
                    example: '+998901234567',
                  },
                  pickup_method: { type: 'string', example: 'Self' },
                  delivery_method: { type: 'string', example: 'Self' },
                  priority: { type: 'string', example: 'High' },
                  source: { type: 'string', example: 'CRM' },
                  assigned_admins: {
                    type: 'string',
                    nullable: true,
                    example: 'John Doe, Jane Doe',
                  },
                  action: {
                    type: 'string',
                    enum: ['order_created', 'status_changed', 'assigned_to_order'],
                    example: 'order_created',
                  },
                  from_status_id: { type: 'string', format: 'uuid', nullable: true },
                  to_status_id: { type: 'string', format: 'uuid', nullable: true },
                  branch_id: { type: 'string', format: 'uuid', nullable: true },
                  assigned_by: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
      ],
    },
  };

  swaggerDoc.paths = {
    ...swaggerDoc.paths,
    '/socket.io/': {
      get: socketIoOperation,
    },
  };
  SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, swaggerDoc);

  // -------- Bull Board wiring --------

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

  const queuesAdapters = [new BullMQAdapter(campaignsQueue)];

  createBullBoard({
    queues: queuesAdapters,
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // Start HTTP
  await app.listen(PORT, HOST);

  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  logger.log(`http://${displayHost}:${PORT}/${GLOBAL_PREFIX}`);
  logger.log(`Swagger: http://${displayHost}:${PORT}/${GLOBAL_PREFIX}/docs`);
  logger.log(`Queues: http://${displayHost}:${PORT}/admin/queues`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap error:', err);
  process.exit(1);
});
