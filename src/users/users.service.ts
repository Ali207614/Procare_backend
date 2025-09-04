import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bull';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { CreateUserDto } from './dto/create-user.dto';
import { FindAllUsersDto } from './dto/find-all-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JoinedRepairOrder, UserWithRepairOrders } from 'src/common/types/repair-order.interface';
import { User } from 'src/common/types/user.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    @InjectQueue('sap') private readonly sapQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  async findOneWithOrders(userId: string): Promise<UserWithRepairOrders> {
    const user: User | undefined = await this.knex('users').where({ id: userId }).first();

    if (!user) {
      throw new NotFoundException({
        message: 'user not found',
        location: 'user_not_found',
      });
    }

    const repairOrders: JoinedRepairOrder[] = await this.knex('repair_orders as ro')
      .leftJoin('users as u', 'ro.user_id', 'u.id')
      .leftJoin('branches as b', 'ro.branch_id', 'b.id')
      .leftJoin('phone_categories as pc', 'ro.phone_category_id', 'pc.id')
      .leftJoin('repair_order_statuses as s', 'ro.status_id', 's.id')
      .select(
        'ro.id',
        'ro.total',
        'ro.imei',
        'ro.delivery_method',
        'ro.pickup_method',
        'ro.priority',
        'ro.status',
        'ro.created_at',
        'b.name_uz as branch_name_uz',
        'b.name_ru as branch_name_ru',
        'b.name_en as branch_name_en',
        'pc.name_uz as phone_name_uz',
        'pc.name_ru as phone_name_ru',
        'pc.name_en as phone_name_en',
        's.name_uz as status_name_uz',
        's.name_ru as status_name_ru',
        's.name_en as status_name_en',
      )
      .where('u.id', userId)
      .orderBy('ro.created_at', 'desc');

    return {
      ...user,
      repair_orders: repairOrders,
    };
  }

  async create(dto: CreateUserDto, admin: AdminPayload): Promise<User> {
    const exists: User | undefined = await this.knex('users')
      .whereRaw('LOWER(phone_number1) = ?', dto.phone_number1.toLowerCase())
      .andWhereNot({ status: 'Deleted' })
      .first();

    if (exists) {
      throw new BadRequestException({
        message: 'Phone number already exists',
        location: 'phone_number',
      });
    }

    const [user]: User[] = await this.knex<User>('users')
      .insert({
        sap_card_code: dto.sap_card_code || null,
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone_number1: dto.phone_number1 ?? null,
        phone_number2: dto.phone_number2 ?? null,
        passport_series: dto.passport_series ?? null,
        birth_date: dto.birth_date ?? null,
        id_card_number: dto.id_card_number ?? null,
        telegram_chat_id: dto.telegram_chat_id ?? null,
        telegram_username: dto.telegram_username ?? null,
        language: dto.language ?? 'uz',
        status: 'Pending',
        source: 'web',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: admin.id,
      })
      .returning('*');

    await this.sapQueue.add(
      'create-bp',
      {
        userId: user.id,
        cardName: `${user.first_name} ${user.last_name}`,
        phone: user.phone_number1,
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
      },
    );

    return user;
  }

  async findAll(query: FindAllUsersDto): Promise<PaginationResult<User>> {
    const offset = Number(query.offset) || 0;
    const limit = Number(query.limit) || 20;

    const q = this.knex('users')
      .select(
        'id',
        'first_name',
        'last_name',
        'sap_card_code',
        'passport_series',
        'id_card_number',
        'birth_date',
        'language',
        'phone_number1',
        'phone_number2',
        'telegram_chat_id',
        'telegram_username',
        'created_at',
        'status',
        'is_active',
      )
      .orderBy('created_at', 'desc')
      .offset(offset)
      .limit(limit);

    if (query.search) {
      const term = `%${query.search.toLowerCase()}%`;
      void q.whereRaw(
        `
        LOWER(first_name) LIKE ?
        OR LOWER(last_name) LIKE ?
        OR phone_number1 ILIKE ?
        OR phone_number2 ILIKE ?
        OR passport_series ILIKE ?
        OR id_card_number ILIKE ?
      `,
        [term, term, term, term, term, term],
      );
    }

    const [rows, [{ count }]] = await Promise.all([
      q,
      this.knex('users')
        .count('* as count')
        .modify((qb) => {
          if (query.search) {
            const term = `%${query.search.toLowerCase()}%`;
            void qb.whereRaw(
              `
              LOWER(first_name) LIKE ?
              OR LOWER(last_name) LIKE ?
              OR phone_number1 ILIKE ?
              OR phone_number2 ILIKE ?
              OR passport_series ILIKE ?
              OR id_card_number ILIKE ?
            `,
              [term, term, term, term, term, term],
            );
          }
        }),
    ]);

    return {
      rows,
      total: Number(count),
      limit,
      offset,
    };
  }
  async update(userId: string, dto: UpdateUserDto): Promise<{ message: string }> {
    const user = await this.knex('users').where({ id: userId, status: 'Open' }).first();

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        location: 'user_not_found',
      });
    }

    await this.knex('users')
      .where({ id: userId })
      .update({
        ...dto,
        updated_at: new Date(),
      });

    await this.redisService.del(`user:${userId}`);

    return { message: 'User updated successfully' };
  }

  async delete(userId: string): Promise<{ message: string }> {
    const user: User | undefined = await this.knex('users')
      .where({ id: userId, status: 'Open' })
      .first();

    if (!user) {
      throw new NotFoundException({
        message: 'User not found or already deleted',
        location: 'user_not_found',
      });
    }

    await this.knex('users').where({ id: userId }).update({
      status: 'Deleted',
      is_active: false,
      updated_at: new Date(),
    });

    await this.redisService.del(`user:${userId}`);

    return { message: 'User deleted successfully' };
  }
}
