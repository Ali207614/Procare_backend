


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
    .setTitle('Procare API')
    .setDescription('API for Admins')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
    }, 'access-token')
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
        const extractError = (errList): { message: string; location: string | null } => {
          for (const err of errList) {
            if (err.constraints && err.contexts) {
              const key = Object.keys(err.constraints)[0];
              return {
                message: err.constraints[key],
                location: err.contexts[key]?.location || null,
              };
            }
            if (err.children?.length) {
              const nested = extractError(err.children);
              if (nested) return nested;
            }
          }
          return { message: 'Unexpected error', location: null };
        };

        const { message, location } = extractError(errors);

        return new BadRequestException({
          message,
          error: 'ValidationError',
          location,
        });
      }
    }),

    // ✅ Custom sanitization pipe
    new SanitizationPipe(), // Foydalanuvchi kiritgan ma’lumotda <script> va XSS hujumlarini tozalaydi
  );



  await app.listen(process.env.PORT);
  logger.log(`Application is running on: http://localhost:${process.env.PORT}/${globalPrefix}`);
  logger.log(`Swagger docs available at: http://localhost:${process.env.PORT}/${globalPrefix}/docs`);
}

bootstrap();