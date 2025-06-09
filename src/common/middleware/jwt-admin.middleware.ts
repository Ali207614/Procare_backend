import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@Injectable()
export class JwtAdminMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.decode(token) as AdminPayload;
                if (decoded?.id) {
                    req.admin = {
                        id: decoded.id,
                        phone_number: decoded.phone_number,
                        role: decoded.role,
                        iat: decoded.iat,
                        exp: decoded.exp,
                    };
                }
            } catch {
                req.admin = undefined;
            }
        }
        next();
    }
}
