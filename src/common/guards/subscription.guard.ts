import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import * as moment from 'moment-timezone';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    @InjectKnex() private readonly knex: Knex,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException({
        message: '⛔ Authentication required.',
        location: 'unauthorized',
      });
    }

    const tz = 'Asia/Tashkent';

    // 📆 Parametrdan date ni olish
    const targetDateStr = request.params?.date || request.body?.booking_date || moment.tz(tz).format('YYYY-MM-DD');

    if (!targetDateStr) {
      throw new ForbiddenException({
        message: '❌ Missing booking date.',
        location: 'booking_date_missing',
      });
    }

    const targetDate = moment.tz(targetDateStr, 'YYYY-MM-DD', tz);
    if (!targetDate.isValid()) {
      throw new ForbiddenException({
        message: '❌ Invalid date format. Use YYYY-MM-DD.',
        location: 'invalid_date_format',
      });
    }

    const cacheKey = `subscription:${user.id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      const end = moment.tz(cached.end_date, tz);
      if (cached.status === 'active' && end.isSameOrAfter(targetDate)) {
        return true;
      } else {
        throw new ForbiddenException({
          message: '⛔ Subscription is not active or expired.',
          location: 'subscription_expired_cache',
        });
      }
    }

    // Redisda bo‘lmasa — DBdan tekshiramiz
    const latestSub = await this.knex('subscriptions')
      .where({ user_id: user.id, status: 'active' })
      .andWhere('end_date', '>=', targetDate.format('YYYY-MM-DD'))
      .orderBy('end_date', 'desc')
      .first();

    if (!latestSub) {
      throw new ForbiddenException({
        message: '⛔ You need an active subscription to access this date.',
        location: 'subscription_required',
      });
    }

    // 🔐 Redisga yozamiz
    const end = moment.tz(latestSub.end_date, tz);
    const now = moment.tz(tz);
    const ttl = end.diff(now, 'seconds');
    await this.redisService.set(
      cacheKey,
      {
        status: latestSub.status,
        end_date: latestSub.end_date,
      },
      ttl,
    );

    // 💡 Yakuniy tekshiruv
    if (end.isSameOrAfter(targetDate)) {
      return true;
    } else {
      throw new ForbiddenException({
        message: '⛔ Subscription does not cover this date.',
        location: 'subscription_expired_final',
      });
    }
  }
}
