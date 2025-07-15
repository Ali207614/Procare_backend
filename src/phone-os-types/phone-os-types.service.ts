import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { CreatePhoneOsTypeDto } from './dto/create-phone-os-type.dto';
import { UpdatePhoneOsTypeDto } from './dto/update-phone-os-type.dto';

@Injectable()
export class PhoneOsTypesService {
  private readonly redisKey = 'phone_os_types:all';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreatePhoneOsTypeDto, adminId: string) {
    const [inserted] = await this.knex('phone_os_types')
      .insert({ ...dto, created_by: adminId })
      .returning('*');

    await this.redisService.del(this.redisKey);
    return inserted;
  }

  async findAll() {
    const cached = await this.redisService.get(this.redisKey);
    if (cached !== null) return cached;

    const osTypes = await this.knex('phone_os_types')
      .where({ is_active: true, status: 'Open' })
      .orderBy('sort', 'asc');

    await this.redisService.set(this.redisKey, osTypes, 3600);
    return osTypes;
  }

  async update(id: string, dto: UpdatePhoneOsTypeDto) {
    const exists = await this.knex('phone_os_types').where({ id, status: 'Open' }).first();

    if (!exists) {
      throw new NotFoundException({ message: 'OS type not found', location: 'id' });
    }

    await this.knex('phone_os_types')
      .where({ id })
      .update({ ...dto, updated_at: new Date() });

    await this.redisService.del(this.redisKey);
    return { message: 'Phone OS type updated successfully' };
  }

  async delete(id: string) {
    const exists = await this.knex('phone_os_types').where({ id, status: 'Open' }).first();

    if (!exists) {
      throw new NotFoundException({
        message: 'OS type not found or already deleted',
        location: 'id',
      });
    }

    await this.knex('phone_os_types')
      .where({ id })
      .update({ status: 'Deleted', updated_at: new Date() });

    await this.redisService.del(this.redisKey);
    return { message: 'Phone OS type deleted (soft)' };
  }
}
