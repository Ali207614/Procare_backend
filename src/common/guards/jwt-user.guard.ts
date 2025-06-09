import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class JwtUserAuthGuard extends AuthGuard('jwt-user') {
    constructor(
        private readonly redisService: RedisService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        const user = request.user;
        if (!user) {
            throw new UnauthorizedException({
                message: 'Unauthorized: Invalid or missing token',
                location: 'invalid_token',
            });
        }

        const authHeader = request.headers['authorization'] as string;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException({
                message: 'Authorization header missing or invalid',
                location: 'missing_authorization',
            });
        }

        const token = authHeader.split(' ')[1];

        const exists = await this.redisService.get(`session:user:${user.id}`);

        if (!exists || exists !== token) {
            throw new UnauthorizedException({
                message: 'Session invalid or expired',
                location: 'invalid_session',
            });
        }

        return true;
    }
}
