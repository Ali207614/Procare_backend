import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { CreateUserDto } from './dto/create-user.dto';
import { FindAllUsersDto, HasTelegramFilter } from './dto/find-all-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserWithRepairOrders } from 'src/common/types/repair-order.interface';
import { User, UserListItem } from 'src/common/types/user.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
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

    const repairOrdersRaw = await this.knex('repair_orders as ro')
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

        // === Branch ===
        'b.id as branch_id',
        'b.name_uz as branch_name_uz',
        'b.name_ru as branch_name_ru',
        'b.name_en as branch_name_en',

        // === Phone Category ===
        'pc.id as phone_category_id',
        'pc.name_uz as phone_name_uz',
        'pc.name_ru as phone_name_ru',
        'pc.name_en as phone_name_en',

        // === Status ===
        's.id as status_id',
        's.name_uz as status_name_uz',
        's.name_ru as status_name_ru',
        's.name_en as status_name_en',
        's.color as status_color',
        's.bg_color as status_bg_color',
      )
      .where('ro.user_id', userId)
      .orderBy('ro.created_at', 'desc');

    const repairOrders = repairOrdersRaw.map((row) => ({
      id: row.id,
      total: row.total,
      imei: row.imei,
      delivery_method: row.delivery_method,
      pickup_method: row.pickup_method,
      priority: row.priority,
      status: row.status,
      created_at: row.created_at,

      branch: {
        id: row.branch_id,
        name_uz: row.branch_name_uz,
        name_ru: row.branch_name_ru,
        name_en: row.branch_name_en,
      },

      phone_category: {
        id: row.phone_category_id,
        name_uz: row.phone_name_uz,
        name_ru: row.phone_name_ru,
        name_en: row.phone_name_en,
      },

      repair_order_status: {
        id: row.status_id,
        name_uz: row.status_name_uz,
        name_ru: row.status_name_ru,
        name_en: row.status_name_en,
        color: row.status_color,
        bg_color: row.status_bg_color,
      },
    }));

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
        status: dto?.status ?? 'Open',
        source: (dto.source as User['source']) ?? 'web',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: admin.id,
      })
      .returning('*');

    // External system integration removed

    return user;
  }

  async findAll(filters: FindAllUsersDto): Promise<PaginationResult<UserListItem>> {
    const offset: number = Number(filters.offset) || 0;
    const limit: number = Number(filters.limit) || 20;

    const baseQuery = this.buildUserQuery(this.knex, filters);

    const [rows, [{ count }]] = await Promise.all([
      baseQuery
        .clone()
        .select(
          'id',
          'customer_code',
          'first_name',
          'last_name',
          'phone_number1',
          'phone_number2',
          'phone_verified',
          'passport_series',
          'id_card_number',
          'birth_date',
          'language',
          'telegram_chat_id',
          'telegram_username',
          'status',
          'is_active',
          'source',
          'created_at',
          'updated_at',
          'created_by',
        )
        .orderBy('created_at', 'desc')
        .offset(offset)
        .limit(limit),

      baseQuery.clone().clearSelect().clearOrder().count<{ count: string }[]>('* as count'),
    ]);

    return {
      rows,
      total: Number(count),
      limit,
      offset,
    };
  }

  async update(userId: string, dto: UpdateUserDto): Promise<{ message: string }> {
    const user: User | undefined = await this.knex<User>('users')
      .where({ id: userId, status: 'Open' })
      .first();

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

  public buildUserQuery(knex: Knex, filters: FindAllUsersDto): Knex.QueryBuilder<User, User[]> {
    const query = knex<User>('users');

    if (filters.created_at_start && filters.created_at_end) {
      void query.whereRaw('DATE(created_at) BETWEEN ? AND ?', [
        filters.created_at_start,
        filters.created_at_end,
      ]);
    } else if (filters.created_at_start) {
      void query.whereRaw('DATE(created_at) >= ?', [filters.created_at_start]);
    } else if (filters.created_at_end) {
      void query.whereRaw('DATE(created_at) <= ?', [filters.created_at_end]);
    }

    // search
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      void query.andWhere((qb) => {
        void qb
          .whereRaw('LOWER(first_name) LIKE ?', [term])
          .orWhereRaw('LOWER(last_name) LIKE ?', [term])
          .orWhereRaw('phone_number1 ILIKE ?', [term])
          .orWhereRaw('phone_number2 ILIKE ?', [term])
          .orWhereRaw('passport_series ILIKE ?', [term])
          .orWhereRaw('id_card_number ILIKE ?', [term])
          .orWhereRaw('telegram_username ILIKE ?', [term]);
      });
    }

    if (filters.status_ids?.length) {
      void query.whereIn('status', filters.status_ids);
    }
    if (filters.exclude_status_ids?.length) {
      void query.whereNotIn('status', filters.exclude_status_ids);
    }

    if (filters.source?.length) {
      void query.whereIn('source', filters.source);
    }
    if (filters.exclude_source?.length) {
      void query.whereNotIn('source', filters.exclude_source);
    }

    if (filters.has_telegram === HasTelegramFilter.TRUE) {
      void query.whereNotNull('telegram_chat_id');
    }
    if (filters.has_telegram === HasTelegramFilter.FALSE) {
      void query.whereNull('telegram_chat_id');
    }

    if (filters.language) {
      void query.where('language', filters.language);
    }

    if (filters.birth_date_start && filters.birth_date_end) {
      void query.whereRaw('DATE(birth_date) BETWEEN ? AND ?', [
        filters.birth_date_start,
        filters.birth_date_end,
      ]);
    } else if (filters.birth_date_start) {
      void query.whereRaw('DATE(birth_date) >= ?', [filters.birth_date_start]);
    } else if (filters.birth_date_end) {
      void query.whereRaw('DATE(birth_date) <= ?', [filters.birth_date_end]);
    }

    return query;
  }
}
