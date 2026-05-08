import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { UserPayload } from '../types/user-payload.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      req.user = undefined;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    try {
      const decoded = verify(token, secret) as UserPayload;
      if (!decoded?.id) {
        throw new UnauthorizedException({
          message: 'Invalid token payload',
          location: 'invalid_payload',
        });
      }
      req.user = {
        id: decoded.id,
        phone_number: decoded.phone_number,
        roles: decoded.roles ?? [],
      };
      return next();
    } catch (error) {
      throw new UnauthorizedException({
        message: 'Invalid or expired token',
        location: 'invalid_token',
      });
    }
  }
}
