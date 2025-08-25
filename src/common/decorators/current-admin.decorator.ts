import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AdminPayload } from '../types/admin-payload.interface';

interface AdminRequest extends Request {
  admin: AdminPayload;
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminPayload => {
    const request = ctx.switchToHttp().getRequest<AdminRequest>();
    return request.admin;
  },
);
