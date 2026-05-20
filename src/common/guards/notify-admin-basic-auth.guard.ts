import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class NotifyAdminBasicAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException({
        message: 'Unauthorized: Missing or invalid basic authorization credentials',
        location: 'basic_auth_header',
      });
    }

    const base64Credentials = authHeader.substring(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');

    // Split credentials into username and password
    const separatorIndex = credentials.indexOf(':');
    if (separatorIndex === -1) {
      throw new UnauthorizedException({
        message: 'Unauthorized: Invalid credentials format',
        location: 'basic_auth_format',
      });
    }

    const username = credentials.substring(0, separatorIndex);
    const password = credentials.substring(separatorIndex + 1);

    const expectedUser = this.configService.get<string>('NOTIFY_ADMIN_BASIC_AUTH_USER');
    const expectedPassword = this.configService.get<string>('NOTIFY_ADMIN_BASIC_AUTH_PASSWORD');

    if (!expectedUser || !expectedPassword) {
      throw new UnauthorizedException({
        message: 'Unauthorized: Basic Auth not configured on server',
        location: 'basic_auth_config',
      });
    }

    // Use timing-safe comparison to protect against timing attacks
    const isUserValid = this.safeCompare(username, expectedUser);
    const isPasswordValid = this.safeCompare(password, expectedPassword);

    if (!isUserValid || !isPasswordValid) {
      throw new UnauthorizedException({
        message: 'Unauthorized: Invalid login or password',
        location: 'basic_auth_credentials',
      });
    }

    return true;
  }

  private safeCompare(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  }
}
