import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { FindRentalPhoneDevicesDto } from './dto/find-rental-phone-devices.dto';

@Injectable()
export class RentalPhoneDevicesService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async findAll(dto: FindRentalPhoneDevicesDto) {
    const { page = 1, limit = 20, search, sort_by = 'created_at', sort_order = 'desc' } = dto;

    const offset = (page - 1) * limit;

    const baseQuery = this.knex('rental_phone_devices').where('is_available', true);

    if (search) {
      baseQuery.andWhere((qb) => {
        qb.whereILike('code', `%${search}%`).orWhereILike('name', `%${search}%`);
      });
    }

    const data = await baseQuery
      .clone()
      .select('id', 'code', 'name', 'is_free', 'price', 'currency', 'is_available', 'created_at')
      .orderBy(sort_by, sort_order)
      .limit(limit)
      .offset(offset);

    return data;
  }
}
