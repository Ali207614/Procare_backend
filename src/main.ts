


import './config/env-loader'
import { ValidationPipe, Logger, BadRequestException, ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SanitizationPipe } from './common/pipe/sanitization.pipe';
import helmet from 'helmet';
import compression from 'compression';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggerService } from './common/logger/logger.service';
import { extractError } from './common/utils/validation.util';




async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new LoggerService();


  app.use(helmet()); // 🛡️ HTTP xavfsizlik uchun (helmet)

  app.use(compression({ threshold: 1024 })); // ⚡ Tezlik va trafigi uchun (gzip)


  app.useGlobalFilters(new HttpExceptionFilter(logger));


  app.enableCors({
    origin: '*',
    credentials: true,
  });

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
  );

  const config = new DocumentBuilder()
    .setTitle('📱 Procare Admin API')
    .setDescription(`
    <b>Procare</b> is an online phone repair management platform.<br />
    This <b>Admin API</b> allows you to manage branches, repair orders, users, and related technical operations.
  `.trim())
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
        description: 'Enter your JWT token in the format: <code>Bearer &lt;token&gt;</code>',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);

  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
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
    new SanitizationPipe(),
  );



  await app.listen(process.env.PORT);
  logger.log(`Application is running on: http://localhost:${process.env.PORT}/${globalPrefix}`);
  logger.log(`Swagger docs available at: http://localhost:${process.env.PORT}/${globalPrefix}/docs`);
}

bootstrap();