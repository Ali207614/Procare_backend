import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { DatabaseError } from 'pg';
import { parsePgError } from '../utils/pg-error.util';

interface ErrorResponse {
  message: string | string[];
  error?: string;
  statusCode: number;
  location?: string;
  [key: string]: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    let message = 'Unexpected error';
    let errorType = 'InternalServerError';

    if (exception instanceof DatabaseError) {
      const parsed = parsePgError(exception); // parsed.status, parsed.message, parsed.errorType, etc.
      const shortMessage =
        exception instanceof Error ? `${exception.name}: ${exception.message}` : parsed.message;
      const stack = exception instanceof Error ? exception.stack : undefined;

      const log = `[${request.method}] ${request.url} - ${parsed.status} → ${parsed.message}`;

      this.logger.error(`${log} → ${shortMessage}`, stack);

      return response.status(parsed.status).json({
        statusCode: parsed.status,
        message: parsed.message,
        error: parsed.errorType,
        location: parsed.location,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const res: any = exceptionResponse;
      message = res.message || message;
      errorType =
        res.error ?? (exception instanceof HttpException ? exception.name : 'InternalServerError');

      if (Array.isArray(res.message)) {
        message = res.message.join(', ');
        errorType = 'ValidationError';
      }
    }

    if (status === 429) {
      message = 'Too many requests, please try again later.';
      errorType = 'RateLimitExceeded';
    }

    if (status === 404) {
      errorType = 'NotFound';
    }

    const errorResponse = {
      statusCode: status,
      message,
      error: errorType,
      location: this.extractLocation(exception),
      timestamp: new Date().toISOString(),
      ...(typeof exceptionResponse === 'object' ? exceptionResponse : {}),
      path: request.url,
    };

    const log = `[${request.method}] ${request.url} - ${status} → ${message}`;
    if (status >= 500) {
      const shortMessage =
        exception instanceof Error ? `${exception.name}: ${exception.message}` : message;
      const stack = exception instanceof Error ? exception.stack : undefined;

      this.logger.error(`${log} → ${shortMessage}`, stack);
    }

    response.status(status).json(errorResponse);
  }

  private extractLocation(exception: unknown): string | null {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const response = res as ErrorResponse;
        return response.location ?? null;
      }
    }
    return null;
  }
}
