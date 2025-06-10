import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { DatabaseError } from 'pg';
import { parsePgError } from '../utils/pg-error.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: LoggerService) { }

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse = exception instanceof HttpException
            ? exception.getResponse()
            : 'Internal server error';

        let message = 'Unexpected error';
        let errorType = 'InternalServerError';

        if (exception instanceof DatabaseError) {
            const parsed = parsePgError(exception);

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
            errorType = res.error ?? (exception instanceof HttpException ? exception.name : 'InternalServerError');

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
            const shortMessage = exception instanceof Error ? `${exception.name}: ${exception.message}` : message;
            this.logger.error(`${log} → ${shortMessage}`);

        }

        response.status(status).json(errorResponse);
    }

    private extractLocation(exception: unknown): string | null {
        if (exception instanceof HttpException) {
            const res = exception.getResponse();

            if (typeof res === 'object' && res !== null && 'location' in res) {
                return (res as any).location;
            }
        }
        return null;
    }
}
