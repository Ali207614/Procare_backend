import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class OnlinePbxAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();
    const token = request.query.token as string;

    if (!token) {
      throw new UnauthorizedException('Token is missing in the query parameters');
    }

    const expectedToken = this.configService.get<string>('ONLINEPBX_WEBHOOK_TOKEN');

    if (token === expectedToken) {
      return true;
    }

    throw new UnauthorizedException('Invalid token');
  }
}
