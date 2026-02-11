import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { FindRentalPhoneDevicesDto } from './dto/find-rental-phone-devices.dto';
import { CreateRentalPhoneDeviceDto } from './dto/create-rental-phone-device.dto';
import { UpdateRentalPhoneDeviceDto } from './dto/update-rental-phone-device.dto';
import { RentalPhoneDevice } from 'src/common/types/rental-phone-device.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { EnumBooleanString } from 'src/roles/dto/find-all-roles.dto';

@Injectable()
export class RentalPhoneDevicesService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  private readonly table = 'rental_phone_devices';

  async findAll(dto: FindRentalPhoneDevicesDto): Promise<PaginationResult<RentalPhoneDevice>> {
    const {
      offset = 0,
      limit = 20,
      search,
      brand,
      status,
      condition,
      is_free,
      is_available,
      min_price,
      max_price,
      currency,
    } = dto;

    const baseQuery = this.knex(this.table).where('is_available', true);

    // Search functionality
    if (search) {
      void baseQuery.andWhere((qb) => {
        void qb
          .whereILike('name', `%${search}%`)
          .orWhereILike('brand', `%${search}%`)
          .orWhereILike('model', `%${search}%`)
          .orWhereILike('imei', `%${search}%`);
      });
    }

    // Brand filter
    if (brand) {
      void baseQuery.andWhere('brand', brand);
    }

    // Status filter
    if (status) {
      void baseQuery.andWhere('status', status);
    }

    // Condition filter
    if (condition) {
      void baseQuery.andWhere('condition', condition);
    }

    // Free filter
    if (is_free === EnumBooleanString.TRUE) {
      void baseQuery.andWhere('is_free', true);
    } else if (is_free === EnumBooleanString.FALSE) {
      void baseQuery.andWhere('is_free', false);
    }

    // Available filter
    if (is_available === EnumBooleanString.TRUE) {
      void baseQuery.andWhere('is_available', true);
    } else if (is_available === EnumBooleanString.FALSE) {
      void baseQuery.andWhere('is_available', false);
    }

    // Price range filter
    if (min_price !== undefined) {
      void baseQuery.andWhere('daily_rent_price', '>=', min_price);
    }
    if (max_price !== undefined) {
      void baseQuery.andWhere('daily_rent_price', '<=', max_price);
    }

    // Currency filter
    if (currency) {
      void baseQuery.andWhere('currency', currency);
    }

    const rows = await baseQuery
      .clone()
      .select(
        'id',
        'name',
        'brand',
        'model',
        'imei',
        'color',
        'storage_capacity',
        'battery_capacity',
        'is_free',
        'daily_rent_price',
        'deposit_amount',
        'currency',
        'is_available',
        'status',
        'condition',
        'notes',
        'specifications',
        'sort',
        'created_at',
        'updated_at',
      )
      .orderBy('sort', 'asc')
      .orderBy('name', 'asc')
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

  async findById(id: string): Promise<RentalPhoneDevice> {
    const device = await this.knex(this.table).where('id', id).where('is_available', true).first();

    if (!device) {
      throw new NotFoundException({
        message: 'Rental phone device not found',
        location: 'device_not_found',
      });
    }

    return device as RentalPhoneDevice;
  }

  async create(dto: CreateRentalPhoneDeviceDto): Promise<RentalPhoneDevice> {
    // Check if IMEI already exists (if provided)
    if (dto.imei) {
      const existingImei = await this.knex(this.table).where('imei', dto.imei).first();

      if (existingImei) {
        throw new BadRequestException({
          message: 'Device with this IMEI already exists',
          location: 'imei_already_exists',
        });
      }
    }

    // Ensure quantity_available is not greater than quantity
    const quantity = dto.quantity ?? 1;
    const quantityAvailable = dto.quantity_available ?? quantity;

    if (quantityAvailable > quantity) {
      throw new BadRequestException({
        message: 'Available quantity cannot be greater than total quantity',
        location: 'invalid_quantity',
      });
    }

    const [newDevice] = await this.knex(this.table)
      .insert({
        name: dto.name,
        brand: dto.brand || null,
        model: dto.model || null,
        imei: dto.imei || null,
        color: dto.color || null,
        storage_capacity: dto.storage_capacity || null,
        battery_capacity: dto.battery_capacity || null,
        is_free: dto.is_free ?? false,
        daily_rent_price: dto.daily_rent_price,
        deposit_amount: dto.deposit_amount ?? 0,
        currency: dto.currency ?? 'UZS',
        is_available: dto.is_available ?? true,
        status: dto.status ?? 'Available',
        condition: dto.condition ?? 'Good',
        notes: dto.notes || null,
        specifications: dto.specifications || null,
        sort: dto.sort ?? 1,
        created_at: this.knex.fn.now(),
        updated_at: this.knex.fn.now(),
      })
      .returning('*');

    return newDevice as RentalPhoneDevice;
  }

  async update(id: string, dto: UpdateRentalPhoneDeviceDto): Promise<RentalPhoneDevice> {
    const existingDevice = await this.findById(id);

    // Check if IMEI already exists (if being updated)
    if (dto.imei && dto.imei !== existingDevice.imei) {
      const imeiExists = await this.knex(this.table)
        .where('imei', dto.imei)
        .where('id', '!=', id)
        .first();

      if (imeiExists) {
        throw new BadRequestException({
          message: 'Device with this IMEI already exists',
          location: 'imei_already_exists',
        });
      }
    }

    // Validate quantity relationship
    if (dto.quantity !== undefined || dto.quantity_available !== undefined) {
      const newQuantity = dto.quantity ?? existingDevice.quantity;
      const newQuantityAvailable = dto.quantity_available ?? existingDevice.quantity_available;

      if (newQuantityAvailable > newQuantity) {
        throw new BadRequestException({
          message: 'Available quantity cannot be greater than total quantity',
          location: 'invalid_quantity',
        });
      }
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException({
        message: 'No update data provided',
        location: 'empty_update_data',
      });
    }

    const [updatedDevice] = await this.knex(this.table)
      .where('id', id)
      .update({
        ...dto,
        updated_at: this.knex.fn.now(),
      })
      .returning('*');

    return updatedDevice as RentalPhoneDevice;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    // Soft delete - mark as unavailable and retired
    await this.knex(this.table).where('id', id).update({
      is_available: false,
      status: 'Retired',
      updated_at: this.knex.fn.now(),
    });
  }

  async updateQuantity(id: string, quantityChange: number): Promise<RentalPhoneDevice> {
    const device = await this.findById(id);

    const newQuantityAvailable = device.quantity_available + quantityChange;

    if (newQuantityAvailable < 0) {
      throw new BadRequestException({
        message: 'Not enough quantity available',
        location: 'insufficient_quantity',
      });
    }

    if (newQuantityAvailable > device.quantity) {
      throw new BadRequestException({
        message: 'Available quantity cannot exceed total quantity',
        location: 'quantity_exceeded',
      });
    }

    const [updatedDevice] = await this.knex(this.table)
      .where('id', id)
      .update({
        quantity_available: newQuantityAvailable,
        is_available: newQuantityAvailable > 0,
        updated_at: this.knex.fn.now(),
      })
      .returning('*');

    return updatedDevice as RentalPhoneDevice;
  }

  async getAvailableDevices(): Promise<RentalPhoneDevice[]> {
    return (await this.knex(this.table)
      .where('is_available', true)
      .where('quantity_available', '>', 0)
      .orderBy('sort', 'asc')
      .orderBy('daily_rent_price', 'asc')) as RentalPhoneDevice[];
  }

  async getDevicesByBrand(brand: string): Promise<RentalPhoneDevice[]> {
    return (await this.knex(this.table)
      .where('is_available', true)
      .where('brand', brand)
      .orderBy('sort', 'asc')
      .orderBy('name', 'asc')) as RentalPhoneDevice[];
  }

  async getStatistics(): Promise<{
    totalDevices: number;
    availableDevices: number;
    rentedDevices: number;
    maintenanceDevices: number;
    totalValue: number;
    averagePrice: number;
  }> {
    const [stats] = await this.knex(this.table)
      .where('is_available', true)
      .select(
        this.knex.raw('COUNT(*) as total_devices'),
        this.knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as available_devices', ['Available']),
        this.knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as rented_devices', ['Rented']),
        this.knex.raw('COUNT(CASE WHEN status = ? THEN 1 END) as maintenance_devices', [
          'Maintenance',
        ]),
        this.knex.raw('SUM(daily_rent_price * quantity) as total_value'),
        this.knex.raw('AVG(daily_rent_price) as average_price'),
      );

    return {
      totalDevices: Number(stats.total_devices) || 0,
      availableDevices: Number(stats.available_devices) || 0,
      rentedDevices: Number(stats.rented_devices) || 0,
      maintenanceDevices: Number(stats.maintenance_devices) || 0,
      totalValue: Number(stats.total_value) || 0,
      averagePrice: Number(stats.average_price) || 0,
    };
  }
}
