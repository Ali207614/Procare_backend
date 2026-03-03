import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class OnlinePbxAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const [type, credentials] = authHeader.split(' ');

    if (type?.toLowerCase() !== 'basic' || !credentials) {
      throw new UnauthorizedException('Invalid authorization type');
    }

    const decoded = Buffer.from(credentials, 'base64').toString();
    const [user, pass] = decoded.split(':');

    const expectedUser = this.configService.get<string>('ONLINEPBX_WEBHOOK_USER');
    const expectedPass = this.configService.get<string>('ONLINEPBX_WEBHOOK_PASS');

    if (user === expectedUser && pass === expectedPass) {
      return true;
    }

    throw new UnauthorizedException('Invalid credentials');
  }
}
