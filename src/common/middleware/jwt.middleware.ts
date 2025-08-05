import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { UserPayload } from '../types/user-payload.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      req.user = undefined;
      return next();
    }

    const token = authHeader.split(' ')[1];
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new Error('JWT_SECRET is not defined');
      }

      const decoded = verify(token, secret) as UserPayload;
      if (!decoded?.id) {
        req.user = undefined;
        return next();
      }

      req.user = {
        id: decoded.id,
        phone_number: decoded.phone_number,
        roles: [],
      };
    } catch (error) {
      req.user = undefined;
    }
    next();
  }
}
