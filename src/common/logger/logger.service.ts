import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger = createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.printf(({ level, message, timestamp, stack }) => {
        const msg = typeof message === 'string' ? message : JSON.stringify(message);
        return `[${timestamp}] ${level.toUpperCase()}: ${msg}${stack ? `\n${stack}` : ''}`;
      }),
    ),

    transports: [
      new transports.Console(),
      new transports.File({ filename: 'logs/app.log', level: 'info' }),
      new transports.File({ filename: 'logs/error.log', level: 'error' }),
    ],
  });

  log(message: string) {
    this.logger.info(message);
  }

  error(message: string, trace?: string) {
    this.logger.error(message, trace ? { stack: trace } : undefined);
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
