import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class JwtAdminAuthGuard extends AuthGuard('jwt-admin') {
  constructor(private readonly redisService: RedisService) {
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
        location: 'missing_authorization-admin',
      });
    }

    const token = authHeader.split(' ')[1];
    const sessionKey = `session:admin:${admin.id}`;

    try {
      const exists: string | null = await this.redisService.get(sessionKey);

      if (exists && exists !== token) {
        throw new UnauthorizedException({
          message: 'Session invalid or expired',
          location: 'invalid_session',
        });
      }
    } catch (err) {
      console.error(err);
    }

    request.admin = admin;
    return true;
  }
}
