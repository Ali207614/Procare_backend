import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestAuditContext } from '../types/request-audit-context.type';
import { getClientIp } from '../utils/request-ip.util';
import { runWithRequestAuditContext } from '../utils/request-audit-context.util';

@Injectable()
export class RequestAuditContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const context: RequestAuditContext = {
      requestId: this.readHeader(req.headers['x-request-id']),
      correlationId:
        this.readHeader(req.headers['x-correlation-id']) ??
        this.readHeader(req.headers['x-correlationid']),
      httpMethod: req.method ?? null,
      httpPath: req.originalUrl ?? req.url ?? null,
      ipAddress: getClientIp(req),
      userAgent: this.readHeader(req.headers['user-agent']),
    };

    runWithRequestAuditContext(context, () => next());
  }

  private readHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }
}
