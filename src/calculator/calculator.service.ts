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
  ): Promise<Omit<PhoneCategoryWithMeta, 'breadcrumb'>[]> {
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
      void query.where('pc.parent_id', parentId);
    } else {
      void query.where({
        'pc.phone_os_type_id': osTypeId,
        'pc.parent_id': null,
      });
    }

    return query;
  }

  async getProblemCategories(phoneCategoryId: string): Promise<ProblemCategoryWithCost[]> {
    // 1. Get root problems linked to this phone category
    const rootProblems = await this.knex('problem_categories as p')
      .join('phone_problem_mappings as ppm', 'ppm.problem_category_id', 'p.id')
      .where({
        'ppm.phone_category_id': phoneCategoryId,
        'p.status': 'Open',
        'p.is_active': true,
      })
      .select<{ id: string }[]>('p.id');

    const rootIds = rootProblems.map((p) => p.id);
    if (rootIds.length === 0) return [];

    // 2. Get all descendants recursively and calculate cost
    const result = await this.knex.raw<{ rows: ProblemCategoryWithCost[] }>(
      `
      WITH RECURSIVE problem_tree AS (
        SELECT 
            id, name_uz, name_ru, name_en, parent_id, price, estimated_minutes, sort, is_active, status
        FROM problem_categories
        WHERE id IN (${rootIds.map(() => '?').join(',')})
        
        UNION ALL
        
        SELECT 
            p.id, p.name_uz, p.name_ru, p.name_en, p.parent_id, p.price, p.estimated_minutes, p.sort, p.is_active, p.status
        FROM problem_categories p
        JOIN problem_tree pt ON p.parent_id = pt.id
        WHERE p.status = 'Open' AND p.is_active = true
      )
      SELECT 
        id, name_uz, name_ru, name_en, parent_id, price, estimated_minutes, sort,
        (
            CAST(price AS DECIMAL) + COALESCE((
                SELECT SUM(rp.part_price)
                FROM repair_part_assignments rpa
                JOIN repair_parts rp ON rp.id = rpa.repair_part_id
                WHERE rpa.problem_category_id = problem_tree.id
                  AND rpa.is_required = true
                  AND rp.status = 'Open'
            ), 0)
        ) as cost
      FROM problem_tree
      ORDER BY sort ASC
    `,
      rootIds,
    );

    return result.rows;
  }
}
