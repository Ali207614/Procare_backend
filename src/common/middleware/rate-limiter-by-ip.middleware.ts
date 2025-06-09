import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RedisClientType } from 'redis';
import { LoggerService } from '../logger/logger.service';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class RateLimiterByIpMiddleware implements NestMiddleware {
    private limiter;

    constructor(
        @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType,
        private readonly logger: LoggerService,
    ) {
        this.limiter = rateLimit({
            windowMs: 60 * 1000,
            max: 10,
            keyGenerator: (req: Request) => req.ip,
            handler: (req: Request, res: Response) => {
                const duration = 0; // bu yerda aniq vaqtni olish qiyin, lekin agar middlewaredan oldin vaqtni saqlasangiz, qo‘shish mumkin

                const statusCode = 429;
                const statusMessage = HttpStatus[statusCode] || 'Too Many Requests';
                const logMessage = `[${req.method}] ${req.originalUrl} - ${statusCode} ${statusMessage} (${duration}ms)`;

                this.logger.warn(logMessage);

                res.status(statusCode).json({
                    statusCode,
                    message: 'Too many requests. Please try again later.',
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
