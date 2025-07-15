import './config/env-loader';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, ClassSerializerInterceptor, BadRequestException } from '@nestjs/common';
import { SanitizationPipe } from './common/pipe/sanitization.pipe';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { extractError } from './common/utils/validation.util';
import helmet from 'helmet';
import compression from 'compression';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import basicAuth from 'express-basic-auth';
import { LoggerService } from 'src/common/logger/logger.service';

async function bootstrap(): Promise<void> {
  try {
    const app = await NestFactory.create(AppModule);
    const logger = new LoggerService();
    const globalPrefix = 'api/v1';

    app.enableCors({
      origin: '*',
      credentials: true,
    });

    app.use(helmet());
    app.use(compression({ threshold: 1024 }));

    app.useGlobalFilters(new HttpExceptionFilter(logger));

    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

    app.useGlobalPipes(
      ...[
        new SanitizationPipe(),
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
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
      ],
    );

    app.setGlobalPrefix(globalPrefix);

    app.use(
      ['/admin/queues'],
      basicAuth({
        users: { [process.env.QUEUE_USER ?? '']: process.env.QUEUE_PASS ?? '' },
        challenge: true,
      }),
    );

    app.use(
      [`/api/v1/docs`],
      basicAuth({
        users: { [process.env.SWAGGER_USER || 'Admin']: process.env.SWAGGER_PASS || '1234' },
        challenge: true,
      }),
    );

    const config = new DocumentBuilder()
      .setTitle('📱 Procare Admin API')
      .setDescription(
        `
    <b>Procare</b> is an online phone repair management platform.<br />
    This <b>Admin API</b> allows you to manage branches, repair orders, users, and related technical operations.
  `.trim(),
      )
      .setVersion('1.0.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
        description: 'Enter your JWT token in the format: <code>Bearer &lt;token&gt;</code>',
      })
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document);

    app.setGlobalPrefix(globalPrefix);

    const sapQueue = app.get<Queue>(getQueueToken('sap'));
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullAdapter(sapQueue)],
      serverAdapter,
    });

    app.use('/admin/queues', serverAdapter.getRouter());

    await app.listen(process.env.PORT || 3000);
    logger.log(`http://localhost:${process.env.PORT}/${globalPrefix}`);
    logger.log(`Swagger: http://localhost:${process.env.PORT}/${globalPrefix}/docs`);
    logger.log(`Queues: http://localhost:${process.env.PORT}/admin/queues`);
  } catch (error) {
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap error:', err);
  process.exit(1);
});
