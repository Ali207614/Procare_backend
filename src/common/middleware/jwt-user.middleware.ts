import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { UserPayload } from '../types/user-payload.interface';

@Injectable()
export class JwtUserMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.decode(token) as UserPayload;
                if (decoded?.id) {
                    req.user = {
                        id: decoded.id,
                        phone_number: decoded.phone_number,
                        role: decoded.role,
                        iat: decoded.iat,
                        exp: decoded.exp,
                    };
                }
            } catch {
                req.user = undefined;
            }
        }
        next();
    }
}
