import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore, { type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import { LoggerService } from '../logger/logger.service';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly limiter;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis | null,
    private readonly logger: LoggerService,
  ) {
    const isRedisAvailable = !!this.redisClient;

    this.limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      keyGenerator: (req: Request): string => req.admin?.id ?? req.ip ?? 'unknown',

      handler: (req: Request, res: Response) => {
        const statusCode = 429;
        const statusMessage = HttpStatus[statusCode] || 'Too Many Requests';
        this.logger.warn(`[${req.method}] ${req.originalUrl} - ${statusCode} ${statusMessage}`);

        res.status(statusCode).json({
          statusCode,
          message: 'Too many users requests. Please try again later.',
          error: 'TooManyRequests',
          location: 'rate_limit',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
      },

      ...(isRedisAvailable
        ? {
            store: new RedisStore({
              sendCommand: (...args: [string, ...string[]]) => {
                if (!this.redisClient) {
                  this.logger.warn('⚠️ Redis not available during sendCommand');
                  return Promise.resolve('' as RedisReply); // fallback bo‘sh javob
                }
                return this.redisClient.call(...args) as unknown as Promise<RedisReply>;
              },
            }),
          }
        : (() => {
            this.logger.warn('⚠️ Redis is not connected. Rate limiting will use MemoryStore.');
            return {};
          })()),
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.limiter(req, res, next);
  }
}
