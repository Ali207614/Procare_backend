import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectKnex, Knex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class BanGuard implements CanActivate {
    constructor(
        private readonly redisService: RedisService,
        private readonly reflector: Reflector,
        @InjectKnex() private readonly knex: Knex,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const user = req.user;

        if (!user?.id) return false;

        const type =
            this.reflector.get<string>('banType', context.getHandler()) || 'review';

        const key = `ban:user:${user.id}:${type}`;
        const cached = await this.redisService.get<{ reason: string; until: string | null }>(key);

        const now = Date.now();

        if (cached) {
            if (cached.reason === null) {
                return true;
            }

            if (!cached.until || new Date(cached.until).getTime() > now) {
                throw new ForbiddenException({
                    message: `You are banned from ${type}: ${cached.reason}`,
                    location: `ban.${type}`,
                });
            }
            return true;
        }

        const ban = await this.knex('user_bans')
            .where({ user_id: user.id, type, is_active: true })
            .andWhere(function () {
                this.whereNull('until').orWhere('until', '>', new Date());
            })
            .first();

        if (ban) {
            const ttl = ban.until
                ? Math.floor((new Date(ban.until).getTime() - now) / 1000)
                : 86400;

            await this.redisService.set(key, { reason: ban.reason, until: ban.until }, ttl);

            throw new ForbiddenException({
                message: `You are banned from ${type}: ${ban.reason}`,
                location: `ban.${type}`,
            });
        }

        await this.redisService.set(key, { reason: null, until: null }, 300);
        return true;
    }
}
