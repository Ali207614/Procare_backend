import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';

export class CampaignFactory {
  static create(overrides?: any): Promise<any>;
  static create(knex: Knex, overrides?: any): Promise<any>;
  static async create(knexOrOverrides: any = {}, overrides: any = {}): Promise<any> {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides;

    if (knexOrOverrides && typeof knexOrOverrides.insert === 'function') {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data = {
      id: uuidv4(),
      type: 'SMS',
      subject: null,
      message: 'Test campaign message',
      target_audience: 'all_users',
      status: 'Pending',
      created_by: uuidv4(),
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      sent_at: null,
      ...actualOverrides,
    };

    if (knex) {
      await knex('campaigns').insert(data);
    }

    return data;
  }

  static createMany(count: number, overrides?: any): Promise<any[]>;
  static createMany(knex: Knex, count: number, overrides?: any): Promise<any[]>;
  static async createMany(knexOrCount: any, countOrOverrides: any = {}, overrides: any = {}): Promise<any[]> {
    let knex: Knex | null = null;
    let count: number;
    let actualOverrides: any;

    if (typeof knexOrCount === 'number') {
      count = knexOrCount;
      actualOverrides = countOrOverrides;
    } else {
      knex = knexOrCount as Knex;
      count = countOrOverrides as number;
      actualOverrides = overrides;
    }

    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.create(knex as any, actualOverrides));
    }
    return results;
  }

  static createDto(overrides = {}) {
    return {
      type: 'SMS',
      message: 'Test SMS message',
      target_audience: 'all_users',
      ...overrides,
    };
  }

  static createPayload(overrides = {}) {
    return {
      id: uuidv4(),
      type: 'SMS',
      message: 'Test SMS message',
      ...overrides,
    };
  }
}
