import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';

export interface CampaignFactoryResult {
  id: string;
  type: string;
  subject: string | null;
  message: string;
  target_audience: string;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  sent_at: Date | null;
}

export class CampaignFactory {
  static create(overrides?: Record<string, unknown>): Promise<CampaignFactoryResult>;
  static create(knex: Knex, overrides?: Record<string, unknown>): Promise<CampaignFactoryResult>;
  static async create(
    knexOrOverrides: Knex | Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ): Promise<CampaignFactoryResult> {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides as Record<string, unknown>;

    if (
      knexOrOverrides &&
      typeof (knexOrOverrides as Record<string, unknown>).insert === 'function'
    ) {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data: CampaignFactoryResult = {
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
    } as CampaignFactoryResult;

    if (knex) {
      await knex('campaigns').insert(data);
    }

    return data;
  }

  static createMany(
    count: number,
    overrides?: Record<string, unknown>,
  ): Promise<CampaignFactoryResult[]>;
  static createMany(
    knex: Knex,
    count: number,
    overrides?: Record<string, unknown>,
  ): Promise<CampaignFactoryResult[]>;
  static async createMany(
    knexOrCount: Knex | number,
    countOrOverrides: number | Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ): Promise<CampaignFactoryResult[]> {
    let knex: Knex | null = null;
    let count: number;
    let actualOverrides: Record<string, unknown>;

    if (typeof knexOrCount === 'number') {
      count = knexOrCount;
      actualOverrides = countOrOverrides as Record<string, unknown>;
    } else {
      knex = knexOrCount;
      count = countOrOverrides as number;
      actualOverrides = overrides;
    }

    const results: CampaignFactoryResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.create(knex ?? actualOverrides, actualOverrides));
    }
    return results;
  }

  static createDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      type: 'SMS',
      message: 'Test SMS message',
      target_audience: 'all_users',
      ...overrides,
    };
  }

  static createPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: uuidv4(),
      type: 'SMS',
      message: 'Test SMS message',
      ...overrides,
    };
  }
}
