import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from 'src/common/redis/redis.service';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAdminAuthGuard extends AuthGuard('jwt-admin') {
    constructor(
        private readonly redisService: RedisService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const activated = await super.canActivate(context);
        if (!activated) {
            return false;
        }

        const request = context.switchToHttp().getRequest();
        const admin = request.user;

        const authHeader = request.headers['authorization'] as string;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException({
                message: 'Authorization header missing or invalid',
                location: 'missing_authorization',
            });
        }

        const token = authHeader.split(' ')[1];

        const exists = await this.redisService.get(`session:admin:${admin.id}`);

        if (!exists || exists !== token) {
            throw new UnauthorizedException({
                message: 'Session invalid or expired',
                location: 'invalid_session',
            });
        }

        // Passport joylagan payload'ni biz qayta admin sifatida qo'yamiz:
        request.admin = admin;

        return true;
    }
}
