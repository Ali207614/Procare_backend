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
    const latestOffer = await this.knex<Offer>('offers').orderBy('created_at', 'desc').first();

    const nextVersion = latestOffer ? this.smartIncrement(latestOffer, createOfferDto) : 'v1.0.0';

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

  private smartIncrement(oldOffer: Offer, newOffer: CreateOfferDto): string {
    const changePercentage = this.calculateChangePercentage(oldOffer, newOffer);

    const parts = oldOffer.version.replace('v', '').split('.');
    if (parts.length !== 3) return 'v1.0.0';

    let [major, minor, patch] = parts.map(Number);

    if (changePercentage > 70) {
      major++;
      minor = 0;
      patch = 0;
    } else if (changePercentage >= 20) {
      minor++;
      patch = 0;
    } else {
      patch++;
    }

    return `v${major}.${minor}.${patch}`;
  }

  private calculateChangePercentage(oldOffer: Offer, newOffer: CreateOfferDto): number {
    const oldVal = oldOffer.content_uz || '';
    const newVal = newOffer.content_uz || '';

    if (!oldVal && !newVal) return 0;

    const distance = this.levenshteinDistance(String(oldVal), String(newVal));
    const maxLen = Math.max(String(oldVal).length, String(newVal).length, 1);

    return (distance / maxLen) * 100;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const n = s1.length;
    const m = s2.length;

    if (n > m) return this.levenshteinDistance(s2, s1);

    let prevRow = new Int32Array(n + 1);
    let currRow = new Int32Array(n + 1);

    for (let i = 0; i <= n; i++) prevRow[i] = i;

    for (let i = 1; i <= m; i++) {
      currRow[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
        currRow[j] = Math.min(
          prevRow[j] + 1, // deletion
          currRow[j - 1] + 1, // insertion
          prevRow[j - 1] + cost, // substitution
        );
      }
      // Swap rows
      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[n];
  }
}
