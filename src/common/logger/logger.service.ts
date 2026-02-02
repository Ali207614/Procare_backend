import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger = createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.printf(({ level, message, timestamp, stack }) => {
        const msg = typeof message === 'string' ? message : JSON.stringify(message);
        const stackStr = stack ? String(stack) : '';
        const timestampStr = typeof timestamp === 'string' ? timestamp : String(timestamp);
        return `[${timestampStr}] ${level.toUpperCase()}: ${msg}${stackStr ? `\n${stackStr}` : ''}`;
      }),
    ),
    transports: [
      new transports.Console(),

      new (transports as typeof transports & { DailyRotateFile: unknown }).DailyRotateFile({
        dirname: 'logs',
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info',
      }),

      new (transports as typeof transports & { DailyRotateFile: unknown }).DailyRotateFile({
        dirname: 'logs',
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
      }),
    ],
  });

  log(message: string): void {
    this.logger.info(message);
  }
  error(message: string, trace?: string): void {
    this.logger.error(message, trace ? { stack: trace } : undefined);
  }
  warn(message: string): void {
    this.logger.warn(message);
  }
  debug(message: string): void {
    this.logger.debug(message);
  }
  verbose(message: string): void {
    this.logger.verbose(message);
  }
}
