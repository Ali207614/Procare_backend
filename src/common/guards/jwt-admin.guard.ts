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
    const admin = request.user; // JwtAdminStrategy dan kelgan user

    if (!admin?.id) {
      throw new UnauthorizedException({
        message: 'Invalid user data',
        location: 'invalid_user_data',
      });
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        message: 'Authorization header missing or invalid',
        location: 'missing_authorization-admin',
      });
    }

    const token = authHeader.split(' ')[1];
    const sessionKey = `session:admin:${admin.id}`;
    const exists = await this.redisService.get(sessionKey);

    if (exists && exists !== token) {
      throw new UnauthorizedException({
        message: 'Session invalid or expired',
        location: 'invalid_session',
      });
    }

    const blacklistKey = `blacklist:token:${token}`;
    const isBlacklisted = await this.redisService.get(blacklistKey);
    if (isBlacklisted) {
      throw new UnauthorizedException({
        message: 'Token has been blacklisted',
        location: 'blacklisted_token',
      });
    }

    request.admin = {
      id: admin.id,
      phone_number: admin.phone_number,
      roles: admin.roles || [], // Strategy dan kelgan roles
    };

    return true;
  }
}
