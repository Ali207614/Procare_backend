import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusMessage = HttpStatus[res.statusCode] || 'Unknown';
      const message = `[${req.method}] ${req.originalUrl} - ${res.statusCode} ${statusMessage} (${duration}ms)`;

      if (res.statusCode >= 500) {
        return;
      } else if (res.statusCode >= 400) {
        this.logger.warn(message);
      } else {
        // this.logger.log(message);
      }
    });

    next();
  }
}
