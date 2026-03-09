import { Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { Offer } from '../common/types/offer.interface';
import { CreateOfferDto } from './dto/create-offer.dto';
import { FindAllOffersDto } from './dto/find-all-offers.dto';
import { PaginationResult } from '../common/utils/pagination.util';

@Injectable()
export class OffersService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async findAll(dto: FindAllOffersDto): Promise<PaginationResult<Offer>> {
    const { limit = 10, offset = 0, status } = dto;

    const baseQuery = this.knex<Offer>('offers').orderBy('created_at', 'desc');

    if (status) {
      void baseQuery.where('status', status);
    }

    const [{ count }] = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string | number }[]>('* as count');

    const rows = await baseQuery.limit(limit).offset(offset);

    return {
      total: Number(count),
      limit,
      offset,
      rows: rows as Offer[],
    };
  }

  async findOne(id: string): Promise<Offer> {
    const offer = await this.knex<Offer>('offers').where({ id }).first();
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }
    return offer;
  }

  async findActive(): Promise<Offer> {
    const offer = await this.knex<Offer>('offers')
      .where({ is_active: true, status: 'Open' })
      .orderBy('created_at', 'desc')
      .first();

    if (!offer) {
      throw new NotFoundException('No active offer found');
    }

    return offer;
  }

  async create(createOfferDto: CreateOfferDto): Promise<Offer> {
    const latestOffer = await this.knex<Offer>('offers').orderBy('version', 'desc').first();

    const nextVersion = latestOffer ? this.incrementVersion(latestOffer.version) : 'v1.0.0';

    // Mark all previous offers as inactive
    await this.knex('offers').update({ is_active: false });

    const [newOffer]: Offer[] = await this.knex<Offer>('offers')
      .insert({
        ...createOfferDto,
        version: nextVersion,
        status: 'Open',
        is_active: true,
      })
      .returning('*');

    return newOffer;
  }

  async remove(id: string): Promise<void> {
    const offer = await this.findOne(id);
    await this.knex('offers')
      .where({ id: offer.id })
      .update({ status: 'Deleted', is_active: false });
  }

  private incrementVersion(version: string): string {
    const parts = version.replace('v', '').split('.');
    if (parts.length !== 3) return 'v1.0.0';
    const [major, minor, patch] = parts.map(Number);
    // Increment minor version for each new "update" via POST
    return `v${major}.${minor + 1}.${patch}`;
  }
}
