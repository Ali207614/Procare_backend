import { Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { PhoneOsType } from 'src/common/types/phone-os-type.interface';
import { PhoneCategoryWithMeta } from 'src/common/types/phone-category.interface';

interface ProblemCategoryWithCost {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  parent_id: string | null;
  price: string;
  estimated_minutes: number;
  sort: number;
  cost: string;
}

@Injectable()
export class CalculatorService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async getOsTypes(): Promise<PhoneOsType[]> {
    return this.knex<PhoneOsType>('phone_os_types')
      .where({ is_active: true, status: 'Open' })
      .orderBy('sort', 'asc');
  }

  async getPhoneCategories(
    osTypeId: string,
    parentId?: string,
    search?: string,
  ): Promise<Omit<PhoneCategoryWithMeta, 'breadcrumb'>[]> {
    const normalizedSearch = search?.trim().toLowerCase();
    const query = this.knex('phone_categories as pc')
      .where({
        'pc.is_active': true,
        'pc.status': 'Open',
      })
      .select(
        'pc.*',
        this.knex.raw(`EXISTS (
          SELECT 1 FROM phone_categories c
          WHERE c.parent_id = pc.id AND c.status = 'Open' AND c.is_active = true
        ) as has_children`),
        this.knex.raw(`EXISTS (
          SELECT 1 FROM phone_problem_mappings ppm
          JOIN problem_categories p ON p.id = ppm.problem_category_id
          WHERE ppm.phone_category_id = pc.id AND p.status = 'Open' AND p.is_active = true
        ) as has_problems`),
      )
      .orderBy('pc.sort', 'asc');

    if (parentId) {
      void query
        .join('phone_categories as p_pc', 'p_pc.id', 'pc.parent_id')
        .where('pc.parent_id', parentId)
        .andWhere({
          'p_pc.status': 'Open',
          'p_pc.is_active': true,
        });
    } else {
      void query.join('phone_os_types as pot', 'pot.id', 'pc.phone_os_type_id').where({
        'pc.phone_os_type_id': osTypeId,
        'pc.parent_id': null,
        'pot.status': 'Open',
        'pot.is_active': true,
      });
    }

    if (normalizedSearch) {
      const searchTerm = `%${normalizedSearch}%`;
      void query.andWhere((builder) => {
        void builder
          .whereRaw('LOWER(pc.name_uz) ILIKE ?', [searchTerm])
          .orWhereRaw('LOWER(pc.name_ru) ILIKE ?', [searchTerm])
          .orWhereRaw('LOWER(pc.name_en) ILIKE ?', [searchTerm]);
      });
    }

    return query;
  }

  async getProblemCategories(phoneCategoryId: string): Promise<ProblemCategoryWithCost[]> {
    const rootProblems = await this.knex('problem_categories as p')
      .join('phone_problem_mappings as ppm', 'ppm.problem_category_id', 'p.id')
      .join('phone_categories as pc', 'pc.id', 'ppm.phone_category_id')
      .where({
        'ppm.phone_category_id': phoneCategoryId,
        'p.parent_id': null,
        'p.status': 'Open',
        'p.is_active': true,
        'pc.status': 'Open',
        'pc.is_active': true,
      })
      .select<{ id: string }[]>('p.id');

    const rootIds = rootProblems.map((p) => p.id);
    if (rootIds.length === 0) return [];

    const result = await this.knex.raw<{ rows: ProblemCategoryWithCost[] }>(
      `
      SELECT 
        p.id, p.name_uz, p.name_ru, p.name_en, p.parent_id, p.price, p.estimated_minutes, p.sort,
        (
            CAST(p.price AS DECIMAL) + COALESCE((
                SELECT SUM(rp.part_price)
                FROM repair_part_assignments rpa
                JOIN repair_parts rp ON rp.id = rpa.repair_part_id
                WHERE rpa.problem_category_id = p.id
                  AND rpa.is_required = true
                  AND rp.status = 'Open'
            ), 0)
        ) as cost
      FROM problem_categories p
      WHERE p.id IN (${rootIds.map(() => '?').join(',')})
        AND p.parent_id IS NULL
        AND p.status = 'Open'
        AND p.is_active = true
      ORDER BY p.sort ASC
    `,
      rootIds,
    );

    return result.rows;
  }
}
