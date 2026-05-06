import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { Branch } from 'src/common/types/branch.interface';
import { RoleType } from 'src/common/types/role-type.enum';

export const MOTHER_BRANCH_ID = '00000000-0000-4000-8000-000000000000';

@Injectable()
export class BranchHierarchyService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  getMotherBranchId(): string {
    return MOTHER_BRANCH_ID;
  }

  getCanonicalStatusBranchId(): string {
    return MOTHER_BRANCH_ID;
  }

  isMotherBranch(branchId: string): boolean {
    return branchId === MOTHER_BRANCH_ID;
  }

  isSuperAdmin(admin: AdminPayload): boolean {
    return admin.roles.some(
      (role) =>
        role.type === RoleType.SUPER_ADMIN || role.name.trim().toLowerCase() === 'super admin',
    );
  }

  async getChildBranchIds(db: Knex | Knex.Transaction = this.knex): Promise<string[]> {
    const rows = await db<Branch>('branches')
      .where({ parent_branch_id: MOTHER_BRANCH_ID, status: 'Open', is_active: true })
      .select('id')
      .orderBy('sort', 'asc');

    return rows.map((row) => row.id);
  }

  async getAdminAssignedBranchIds(
    adminId: string,
    db: Knex | Knex.Transaction = this.knex,
  ): Promise<string[]> {
    const rows = await db('admin_branches as ab')
      .join('branches as b', 'b.id', 'ab.branch_id')
      .where({ 'ab.admin_id': adminId, 'b.status': 'Open', 'b.is_active': true })
      .select<{ branch_id: string }[]>('ab.branch_id');

    return rows.map((row) => row.branch_id);
  }

  async getVisibleBranchIds(
    admin: AdminPayload,
    db: Knex | Knex.Transaction = this.knex,
  ): Promise<string[]> {
    const childIds = await this.getChildBranchIds(db);

    if (this.isSuperAdmin(admin)) {
      return [MOTHER_BRANCH_ID, ...childIds];
    }

    const assignedIds = await this.getAdminAssignedBranchIds(admin.id, db);
    if (assignedIds.includes(MOTHER_BRANCH_ID)) {
      return [MOTHER_BRANCH_ID, ...childIds];
    }

    const assignedChildIds = assignedIds.filter((id) => childIds.includes(id));
    if (!assignedChildIds.length) {
      return [];
    }

    return [...new Set([MOTHER_BRANCH_ID, ...assignedChildIds])];
  }

  async getWritableBranchIds(
    admin: AdminPayload,
    options: { includeMotherForSystemFlows?: boolean } = {},
    db: Knex | Knex.Transaction = this.knex,
  ): Promise<string[]> {
    const childIds = await this.getChildBranchIds(db);
    const includeMother = options.includeMotherForSystemFlows === true;

    if (this.isSuperAdmin(admin)) {
      return includeMother ? [MOTHER_BRANCH_ID, ...childIds] : childIds;
    }

    const assignedIds = await this.getAdminAssignedBranchIds(admin.id, db);
    if (assignedIds.includes(MOTHER_BRANCH_ID)) {
      return includeMother ? [MOTHER_BRANCH_ID, ...childIds] : childIds;
    }

    return assignedIds.filter((id) => childIds.includes(id));
  }

  async assertVisibleBranch(
    admin: AdminPayload,
    branchId: string,
    db: Knex | Knex.Transaction = this.knex,
  ): Promise<void> {
    const visibleBranchIds = await this.getVisibleBranchIds(admin, db);
    if (!visibleBranchIds.includes(branchId)) {
      throw new ForbiddenException({
        message: 'You do not have access to this branch',
        location: 'branch_id',
      });
    }
  }

  async assertWritableBranch(
    admin: AdminPayload,
    branchId: string,
    options: { includeMotherForSystemFlows?: boolean } = {},
    db: Knex | Knex.Transaction = this.knex,
  ): Promise<void> {
    const writableBranchIds = await this.getWritableBranchIds(admin, options, db);
    if (!writableBranchIds.includes(branchId)) {
      throw new ForbiddenException({
        message: 'You do not have write access to this branch',
        location: 'branch_id',
      });
    }
  }

  async assertChildBranch(
    branchId: string,
    db: Knex | Knex.Transaction = this.knex,
  ): Promise<Branch> {
    const branch = await db<Branch>('branches')
      .where({
        id: branchId,
        parent_branch_id: MOTHER_BRANCH_ID,
        status: 'Open',
        is_active: true,
      })
      .first();

    if (!branch) {
      throw new ForbiddenException({
        message: 'Target branch must be an active child branch',
        location: 'branch_id',
      });
    }

    return branch;
  }
}
