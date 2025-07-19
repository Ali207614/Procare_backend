import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RedisClientType } from 'redis';
import { LoggerService } from '../logger/logger.service';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private limiter;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType,
    private readonly logger: LoggerService,
  ) {
    this.limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 20,
      keyGenerator: (req: Request): string => {
        return req.admin?.id ?? req.ip ?? 'unknown';
      },
      handler: (req: Request, res: Response) => {
        const duration = 0;

        const statusCode = 429;
        const statusMessage = HttpStatus[statusCode] || 'Too Many Requests';
        const logMessage = `[${req.method}] ${req.originalUrl} - ${statusCode} ${statusMessage} (${duration}ms)`;

        this.logger.warn(logMessage);

        res.status(statusCode).json({
          statusCode,
          message: 'Too many users requests. Please try again later.',
          error: 'TooManyRequests',
          location: 'rate_limit',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
      },
      store: new RedisStore({
        sendCommand: (...args: string[]) => this.redisClient.sendCommand(args.map(String)),
      }),
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.limiter(req, res, next);
  }
}
