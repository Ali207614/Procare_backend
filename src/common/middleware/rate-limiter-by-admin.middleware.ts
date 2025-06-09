import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RedisClientType } from 'redis';
import { LoggerService } from '../logger/logger.service';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class RateLimiterAdminMiddleware implements NestMiddleware {
    private limiter;

    constructor(
        @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType,
        private readonly logger: LoggerService,
    ) {
        this.limiter = rateLimit({
            windowMs: 60 * 1000,
            max: 40, // Admin uchun yuqori limit
            keyGenerator: (req) => req?.admin?.id || req.ip,
            skip: (req: Request) => !req?.admin, // ❗ faqat adminlar uchun ishlaydi
            handler: (req: Request, res: Response) => {
                const statusCode = 429;
                const statusMessage = HttpStatus[statusCode] || 'Too Many Requests';
                const logMessage = `[${req.method}] ${req.originalUrl} - ${statusCode} ${statusMessage}`;

                this.logger.warn(logMessage);

                res.status(statusCode).json({
                    statusCode,
                    message: 'Too many requests (admin limit). Please try again later.',
                    error: 'TooManyRequests',
                    location: 'admin_rate_limit',
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
