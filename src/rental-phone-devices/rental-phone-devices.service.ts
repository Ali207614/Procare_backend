import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { FindRentalPhoneDevicesDto } from './dto/find-rental-phone-devices.dto';
import { RentalPhoneDevice } from 'src/common/types/rental-phone-device.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { EnumBooleanString } from 'src/roles/dto/find-all-roles.dto';

@Injectable()
export class RentalPhoneDevicesService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async findAll(dto: FindRentalPhoneDevicesDto): Promise<PaginationResult<RentalPhoneDevice>> {
    const { offset = 0, limit = 20, search, is_free, is_available, currency } = dto;

    const baseQuery = this.knex('rental_phone_devices').whereRaw('1=1');

    if (search) {
      void baseQuery.andWhere((qb) => {
        void qb.whereILike('code', `%${search}%`).orWhereILike('name', `%${search}%`);
      });
    }

    if (is_free === EnumBooleanString.TRUE) {
      void baseQuery.andWhere('is_free', true);
    } else if (is_free === EnumBooleanString.FALSE) {
      void baseQuery.andWhere('is_free', false);
    }

    if (is_available === EnumBooleanString.TRUE) {
      void baseQuery.andWhere('is_available', true);
    } else if (is_available === EnumBooleanString.FALSE) {
      void baseQuery.andWhere('is_available', false);
    }

    if (currency) {
      void baseQuery.andWhere('currency', currency);
    }

    const rows = await baseQuery
      .clone()
      .select(
        'id',
        'code',
        'name',
        'is_free',
        'price',
        'currency',
        'is_available',
        'sort',
        'notes',
        'created_at',
        'updated_at',
      )
      .orderBy('sort', 'asc')
      .limit(limit)
      .offset(offset);

    const [{ count }] = await baseQuery.clone().count<{ count: string }[]>('* as count');

    return {
      rows,
      total: Number(count),
      limit,
      offset,
    };
  }
}
