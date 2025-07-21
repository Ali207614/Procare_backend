import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { decode } from 'jsonwebtoken';
import { UserPayload } from '../types/user-payload.interface';
import { AdminsService } from 'src/admins/admins.service';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly adminsService: AdminsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = decode(token) as UserPayload;

        const roles: string[] = await this.adminsService.findRolesByAdminId(decoded.id);

        if (decoded?.id) {
          req.user = {
            id: decoded.id,
            phone_number: decoded.phone_number,
            roles: roles,
            iat: decoded.iat,
            exp: decoded.exp,
          };
        } else {
          req.user = undefined;
        }
      } catch {
        req.user = undefined;
      }
    }
    next();
  }
}
