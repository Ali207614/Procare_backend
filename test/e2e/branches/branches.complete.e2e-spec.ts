import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BranchesService } from 'src/branches/branches.service';
import { AuthService } from 'src/auth/auth.service';
import { TestModuleBuilder } from '../../utils/test-module-builder';
import { CoverageHelpers } from '../../utils/coverage-helpers';
import { Knex } from 'knex';
import Redis from 'ioredis';

import { Branch } from 'src/common/types/branch.interface';

interface BaseRecord {
  id: string;
}

interface AdminRecord extends BaseRecord {
  first_name: string;
  last_name: string;
  phone_number: string;
  status: string;
}

interface BranchRecord extends BaseRecord {
  name_uz: string;
  name_ru: string;
  name_en: string;
  address_uz: string;
  address_ru: string;
  address_en: string;
  support_phone: string;
  status: string;
  sort: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

interface BranchAdminAssignmentRecord extends BaseRecord {
  branch_id: string;
  admin_id: string;
  created_at: Date;
  updated_at: Date;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface BranchWithAdmins extends BranchRecord {
  admins: AdminRecord[];
}

describe('Branches Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let branchesService: BranchesService;
  let knex: Knex;
  let redis: Redis;
  let adminToken: string;
  let limitedAdminToken: string;
  let testAdmin: AdminRecord;
  let limitedAdmin: AdminRecord;
  let testBranch: BranchRecord;
  let secondTestBranch: BranchRecord;
  let testRole: BaseRecord;

  beforeAll(async (): Promise<void> => {
    const moduleBuilder = new TestModuleBuilder();
    const module: TestingModule = await moduleBuilder
      .withRealDatabase()
      .withRealRedis()
      .withExternalServiceMocks()
      .build();

    app = module.createNestApplication();
    await app.init();

    // Get services
    authService = module.get<AuthService>(AuthService);
    branchesService = module.get<BranchesService>(BranchesService);
    knex = module.get<Knex>('KNEX_CONNECTION');
    redis = module.get<Redis>('REDIS_CLIENT');

    // Clean database and cache
    await knex.raw('DELETE FROM branch_admin_assignments');
    await knex.raw('DELETE FROM repair_orders');
    await knex.raw('DELETE FROM admin_role_permissions');
    await knex.raw('DELETE FROM role_permissions');
    await knex.raw('DELETE FROM admin_roles');
    await knex.raw('DELETE FROM admins');
    await knex.raw('DELETE FROM roles');
    await knex.raw('DELETE FROM permissions');
    await knex.raw('DELETE FROM branches');
    await redis.flushall();

    // Setup test data
    await setupTestData();
  });

  afterAll(async (): Promise<void> => {
    // Clean up
    await knex.raw('DELETE FROM branch_admin_assignments');
    await knex.raw('DELETE FROM repair_orders');
    await knex.raw('DELETE FROM admin_role_permissions');
    await knex.raw('DELETE FROM role_permissions');
    await knex.raw('DELETE FROM admin_roles');
    await knex.raw('DELETE FROM admins');
    await knex.raw('DELETE FROM roles');
    await knex.raw('DELETE FROM permissions');
    await knex.raw('DELETE FROM branches');
    await redis.flushall();
    await app.close();
  });

  async function setupTestData(): Promise<void> {
    // Create branch permissions
    const branchPermissions = [
      'branch.create',
      'branch.view',
      'branch.update',
      'branch.delete',
      'branch.assign.admins',
    ];

    for (const permission of branchPermissions) {
      await knex('permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        name: permission,
        description: `Permission for ${permission}`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test role with all branch permissions
    const roles: BaseRecord[] = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Branch Manager Role',
        description: 'Role for managing branches',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testRole = roles[0];

    // Create limited role with only view permission
    const limitedRoles: BaseRecord[] = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Limited Role',
        description: 'Role with limited permissions',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const limitedRoleRecord = limitedRoles[0];

    // Assign permissions to roles
    const allPermissions: BaseRecord[] = await knex('permissions').select('*');
    for (const permission of allPermissions) {
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: testRole.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Only assign view permission to limited role
      const p = permission as BaseRecord & { name: string };
      if (p.name === 'branch.view') {
        await knex('role_permissions').insert({
          id: knex.raw('gen_random_uuid()'),
          role_id: limitedRoleRecord.id,
          permission_id: p.id,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    // Create test branches
    const branch1: BranchRecord[] = await knex('branches')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name_uz: 'Main Branch',
        name_ru: 'Main Branch RU',
        name_en: 'Main Branch EN',
        address_uz: '123 Main Street',
        address_ru: '123 Main Street RU',
        address_en: '123 Main Street EN',
        support_phone: '+998901234567',
        status: 'Open',
        sort: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testBranch = branch1[0];

    const branch2: BranchRecord[] = await knex('branches')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name_uz: 'Second Branch',
        name_ru: 'Second Branch RU',
        name_en: 'Second Branch EN',
        address_uz: '456 Second Street',
        address_ru: '456 Second Street RU',
        address_en: '456 Second Street EN',
        support_phone: '+998902345678',
        status: 'Open',
        sort: 2,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondTestBranch = branch2[0];

    // Create test admins
    const admin1: AdminRecord[] = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Test',
        last_name: 'Admin',
        phone_number: '+998901111111',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testAdmin = admin1[0];

    const admin2: AdminRecord[] = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Limited',
        last_name: 'Admin',
        phone_number: '+998902222222',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    limitedAdmin = admin2[0];

    // Assign roles to admins
    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: testAdmin.id,
      role_id: testRole.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: limitedAdmin.id,
      role_id: limitedRoleRecord.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Generate tokens
    adminToken = authService.generateJwtToken({
      id: testAdmin.id,
      phone_number: testAdmin.phone_number,
      roles: [{ id: testRole.id, name: 'Branch Manager Role' }],
    });

    limitedAdminToken = authService.generateJwtToken({
      id: limitedAdmin.id,
      phone_number: limitedAdmin.phone_number,
      roles: [{ id: limitedRoleRecord.id, name: 'Limited Role' }],
    });
  }

  describe('POST /api/v1/branches (Create Branch)', () => {
    it('should create branch successfully with proper permissions', async (): Promise<void> => {
      const newBranchData = {
        name_uz: 'New Branch',
        name_ru: 'New Branch RU',
        name_en: 'New Branch EN',
        address_uz: '789 New Street',
        address_ru: '789 New Street RU',
        address_en: '789 New Street EN',
        support_phone: '+998903456789',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newBranchData)
        .expect(201);

      const body = response.body as BranchRecord;
      expect(body).toMatchObject({
        id: expect.any(String),
        name_uz: newBranchData.name_uz,
        address_uz: newBranchData.address_uz,
        support_phone: newBranchData.support_phone,
        status: 'Open',
        sort: expect.any(Number),
      });

      // Verify branch was created in database
      const createdBranch = (await knex('branches').where('id', body.id).first()) as BranchRecord;
      expect(createdBranch).toBeTruthy();
      expect(createdBranch.name_uz).toBe(newBranchData.name_uz);
    });

    it('should fail with duplicate branch name', async (): Promise<void> => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name_uz: testBranch.name_uz,
          name_ru: testBranch.name_ru,
          name_en: testBranch.name_en,
          address_uz: 'Different Address',
          support_phone: '+998904567890',
        })
        .expect(400);
    });

    it('should fail with invalid data validation', async (): Promise<void> => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name_uz: '', // Empty name
          address_uz: 'Valid Address',
          support_phone: 'invalid-phone', // Invalid phone format
        })
        .expect(400);
    });

    it('should fail without proper permissions', async (): Promise<void> => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name_uz: 'Unauthorized Branch',
          name_ru: 'Unauthorized Branch',
          name_en: 'Unauthorized Branch',
          address_uz: 'Some Address',
          support_phone: '+998905678901',
        })
        .expect(403);
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .send({
          name_uz: 'No Auth Branch',
          name_ru: 'No Auth Branch',
          name_en: 'No Auth Branch',
          address_uz: 'Some Address',
          support_phone: '+998906789012',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/branches (Get All Branches)', () => {
    beforeEach(async (): Promise<void> => {
      // Create additional test branches for pagination tests
      for (let i = 1; i <= 5; i++) {
        await knex('branches').insert({
          id: knex.raw('gen_random_uuid()'),
          name_uz: `Branch ${i}`,
          name_ru: `Branch ${i}`,
          name_en: `Branch ${i}`,
          address_uz: `${i} Test Street`,
          support_phone: `+99890${3000 + i}`,
          status: i % 2 === 0 ? 'Open' : 'Deleted',
          sort: i + 10,
          created_at: new Date(Date.now() - i * 86400000),
          updated_at: new Date(),
        });
      }
    });

    it('should return all branches with default pagination', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<BranchRecord>;
      expect(body).toMatchObject({
        data: expect.any(Array),
        meta: {
          total: expect.any(Number),
          limit: expect.any(Number),
          offset: expect.any(Number),
        },
      });

      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.total).toBeGreaterThanOrEqual(body.data.length);
    });

    it('should search branches by name', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches?search=Main Branch')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<BranchRecord>;
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].name_uz).toBe('Main Branch');
    });

    it('should paginate results correctly', async (): Promise<void> => {
      const limit = 3;
      const offset = 2;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<BranchRecord>;
      expect(body.meta.limit).toBe(limit);
      expect(body.meta.offset).toBe(offset);
      expect(body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should return branches sorted by sort field', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<BranchRecord>;
      const sorts = body.data.map((branch) => branch.sort);
      const sortedSorts = [...sorts].sort((a, b) => a - b);
      expect(sorts).toEqual(sortedSorts);
    });

    it('should return empty results for non-matching search', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches?search=NonExistentBranch')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<BranchRecord>;
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });

    it('should fail with invalid query parameters', async (): Promise<void> => {
      await request(app.getHttpServer())
        .get('/api/v1/branches?limit=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without proper permissions', async (): Promise<void> => {
      await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(200); // Limited admin has branch.view permission
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer()).get('/api/v1/branches').expect(401);
    });
  });

  describe('GET /api/v1/branches/viewable (Get My Branches)', () => {
    beforeEach(async (): Promise<void> => {
      // Assign admin to specific branches
      await knex('branch_admin_assignments').insert({
        id: knex.raw('gen_random_uuid()'),
        branch_id: testBranch.id,
        admin_id: testAdmin.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    it('should return branches assigned to current admin', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches/viewable')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<BranchRecord>;
      expect(body).toMatchObject({
        data: expect.any(Array),
        meta: {
          total: expect.any(Number),
          limit: expect.any(Number),
          offset: expect.any(Number),
        },
      });

      // Should return at least the assigned branch
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('should paginate assigned branches correctly', async (): Promise<void> => {
      const limit = 1;
      const offset = 0;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches/viewable?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<BranchRecord>;
      expect(body.meta.limit).toBe(limit);
      expect(body.meta.offset).toBe(offset);
      expect(body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should return empty if admin has no assigned branches', async (): Promise<void> => {
      // Remove branch assignments for limited admin
      await knex('branch_admin_assignments').where('admin_id', limitedAdmin.id).del();

      const response = await request(app.getHttpServer())
        .get('/api/v1/branches/viewable')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<BranchRecord>;
      expect(body.data).toHaveLength(0);
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer()).get('/api/v1/branches/viewable').expect(401);
    });
  });

  describe('GET /api/v1/branches/:branch_id (Get Branch by ID)', () => {
    it('should return branch with assigned admins successfully', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as BranchWithAdmins;
      expect(body).toMatchObject({
        id: testBranch.id,
        name_uz: testBranch.name_uz,
        status: testBranch.status,
        admins: expect.any(Array),
      });
    });

    it('should return branch without admins if none assigned', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as BranchWithAdmins;
      expect(body.admins).toHaveLength(0);
    });

    it('should fail when getting non-existent branch', async (): Promise<void> => {
      await request(app.getHttpServer())
        .get('/api/v1/branches/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async (): Promise<void> => {
      await request(app.getHttpServer())
        .get('/api/v1/branches/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without proper permissions', async (): Promise<void> => {
      // Remove branch.view permission from limited admin
      const adminRoles: { role_id: string }[] = await knex('admin_roles')
        .where('admin_id', limitedAdmin.id)
        .select('role_id');
      const adminRole = adminRoles[0];

      await knex('role_permissions')
        .join('permissions', 'permissions.id', 'role_permissions.permission_id')
        .where('permissions.name', 'branch.view')
        .andWhere('role_permissions.role_id', adminRole.role_id)
        .del();

      await request(app.getHttpServer())
        .get(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer()).get(`/api/v1/branches/${testBranch.id}`).expect(401);
    });
  });

  describe('PATCH /api/v1/branches/:branch_id/sort (Update Branch Sort)', () => {
    it('should update branch sort successfully', async (): Promise<void> => {
      const newSort = 100;

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}/sort`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: newSort })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Sort updated successfully',
      });

      // Verify sort was updated in database
      const updatedBranch = (await knex('branches')
        .where('id', testBranch.id)
        .first()) as BranchRecord;
      expect(updatedBranch.sort).toBe(newSort);
    });

    it('should fail with invalid sort value', async (): Promise<void> => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}/sort`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: -1 }) // Negative sort value
        .expect(400);
    });

    it('should fail when updating non-existent branch', async (): Promise<void> => {
      await request(app.getHttpServer())
        .patch('/api/v1/branches/00000000-0000-4000-8000-000000000000/sort')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: 50 })
        .expect(404);
    });

    it('should fail without proper permissions', async (): Promise<void> => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}/sort`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({ sort: 50 })
        .expect(403);
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}/sort`)
        .send({ sort: 50 })
        .expect(401);
    });
  });

  describe('PATCH /api/v1/branches/:branch_id (Update Branch)', () => {
    it('should update branch successfully', async (): Promise<void> => {
      const updateData = {
        name_uz: 'Updated Main Branch',
        address_uz: 'Updated Address',
        support_phone: '+998999999999',
        status: 'Open',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Branch updated successfully',
      });

      // Verify branch was updated in database
      const updatedBranch = (await knex('branches')
        .where('id', testBranch.id)
        .first()) as BranchRecord;
      expect(updatedBranch.name_uz).toBe(updateData.name_uz);
      expect(updatedBranch.address_uz).toBe(updateData.address_uz);
      expect(updatedBranch.support_phone).toBe(updateData.support_phone);
    });

    it('should update partial branch data', async (): Promise<void> => {
      const updateData = {
        name_uz: 'Partially Updated Branch',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Branch updated successfully',
      });

      // Verify only specified field was updated
      const updatedBranch = (await knex('branches')
        .where('id', secondTestBranch.id)
        .first()) as BranchRecord;
      expect(updatedBranch.name_uz).toBe(updateData.name_uz);
      expect(updatedBranch.address_uz).toBe(secondTestBranch.address_uz); // Should remain unchanged
    });

    it('should fail when updating non-existent branch', async (): Promise<void> => {
      await request(app.getHttpServer())
        .patch('/api/v1/branches/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name_uz: 'Non-existent Branch',
        })
        .expect(404);
    });

    it('should fail with duplicate name', async (): Promise<void> => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name_uz: testBranch.name_uz, // Trying to use existing name
        })
        .expect(400);
    });

    it('should fail without proper permissions', async (): Promise<void> => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name_uz: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}`)
        .send({
          name_uz: 'No Auth Update',
        })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/branches/:branch_id (Delete Branch)', () => {
    it('should delete branch successfully', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Branch deleted successfully',
      });

      // Verify branch was soft deleted in database
      const deletedBranch = (await knex('branches')
        .where('id', secondTestBranch.id)
        .first()) as BranchRecord;
      expect(deletedBranch.status).toBe('Deleted');
    });

    it('should fail when deleting non-existent branch', async (): Promise<void> => {
      await request(app.getHttpServer())
        .delete('/api/v1/branches/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail without proper permissions', async (): Promise<void> => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer()).delete(`/api/v1/branches/${testBranch.id}`).expect(401);
    });
  });

  describe('POST /api/v1/branches/:branch_id/admins (Assign Admins)', () => {
    it('should assign admins to branch successfully', async (): Promise<void> => {
      const adminIds = [limitedAdmin.id];

      const response = await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Admins assigned successfully',
      });

      // Verify assignment was created in database
      const assignment = (await knex('branch_admin_assignments')
        .where('branch_id', testBranch.id)
        .andWhere('admin_id', limitedAdmin.id)
        .first()) as BranchAdminAssignmentRecord;
      expect(assignment).toBeTruthy();
    });

    it('should assign multiple admins to branch', async (): Promise<void> => {
      // Create additional admin for testing
      const additionalAdminResult: AdminRecord[] = await knex('admins')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: 'Additional',
          last_name: 'Admin',
          phone_number: '+998903333333',
          password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
          status: 'Open',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const additionalAdmin = additionalAdminResult[0];
      const adminIds = [testAdmin.id, additionalAdmin.id];

      const response = await request(app.getHttpServer())
        .post(`/api/v1/branches/${secondTestBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Admins assigned successfully',
      });

      // Verify all assignments were created
      const assignments = (await knex('branch_admin_assignments').where(
        'branch_id',
        secondTestBranch.id,
      )) as BranchAdminAssignmentRecord[];
      expect(assignments.length).toBe(adminIds.length);
    });

    it('should fail with non-existent admin IDs', async (): Promise<void> => {
      const adminIds = ['00000000-0000-4000-8000-000000000000'];

      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(404);
    });

    it('should fail with duplicate assignment', async (): Promise<void> => {
      // First assignment
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(201);

      // Duplicate assignment
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(400);
    });

    it('should fail with empty admin IDs array', async (): Promise<void> => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [] })
        .expect(400);
    });

    it('should fail when assigning to non-existent branch', async (): Promise<void> => {
      await request(app.getHttpServer())
        .post('/api/v1/branches/00000000-0000-4000-8000-000000000000/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(404);
    });

    it('should fail without proper permissions', async (): Promise<void> => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(403);
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/branches/:branch_id/admins (Remove Admins)', () => {
    beforeEach(async (): Promise<void> => {
      // Create assignments to remove
      await knex('branch_admin_assignments').insert({
        id: knex.raw('gen_random_uuid()'),
        branch_id: testBranch.id,
        admin_id: testAdmin.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await knex('branch_admin_assignments').insert({
        id: knex.raw('gen_random_uuid()'),
        branch_id: testBranch.id,
        admin_id: limitedAdmin.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    it('should remove admins from branch successfully', async (): Promise<void> => {
      const adminIds = [limitedAdmin.id];

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Admins removed successfully',
      });

      // Verify assignment was removed from database
      const assignment = (await knex('branch_admin_assignments')
        .where('branch_id', testBranch.id)
        .andWhere('admin_id', limitedAdmin.id)
        .first()) as BranchAdminAssignmentRecord;
      expect(assignment).toBeFalsy();
    });

    it('should remove multiple admins from branch', async (): Promise<void> => {
      const adminIds = [testAdmin.id, limitedAdmin.id];

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Admins removed successfully',
      });

      // Verify all assignments were removed
      const assignments = (await knex('branch_admin_assignments')
        .where('branch_id', testBranch.id)
        .whereIn('admin_id', adminIds)) as BranchAdminAssignmentRecord[];
      expect(assignments.length).toBe(0);
    });

    it('should fail with non-existent assignment', async (): Promise<void> => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${secondTestBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] }) // No assignment exists for this branch-admin pair
        .expect(404);
    });

    it('should fail with empty admin IDs array', async (): Promise<void> => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [] })
        .expect(400);
    });

    it('should fail when removing from non-existent branch', async (): Promise<void> => {
      await request(app.getHttpServer())
        .delete('/api/v1/branches/00000000-0000-4000-8000-000000000000/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(404);
    });

    it('should fail without proper permissions', async (): Promise<void> => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(403);
    });

    it('should fail without authentication', async (): Promise<void> => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(401);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity', async (): Promise<void> => {
      const branches = (await knex('branches').select('*')) as BranchRecord[];
      const assignments = (await knex('branch_admin_assignments').select(
        '*',
      )) as BranchAdminAssignmentRecord[];
      const admins = (await knex('admins').select('*')) as AdminRecord[];

      for (const assignment of assignments) {
        const branch = branches.find((b) => b.id === assignment.branch_id);
        const admin = admins.find((a) => a.id === assignment.admin_id);
        expect(branch).toBeTruthy();
        expect(admin).toBeTruthy();
      }
    });

    it('should maintain audit fields correctly', async (): Promise<void> => {
      const branches = (await knex('branches').select('*')) as BranchRecord[];

      for (const branch of branches) {
        expect(branch.created_at).toBeTruthy();
        expect(branch.updated_at).toBeTruthy();
        expect(new Date(branch.created_at)).toBeInstanceOf(Date);
        expect(new Date(branch.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should properly handle soft deletes', async (): Promise<void> => {
      // Soft delete a branch
      await branchesService.delete(testBranch as unknown as Branch);

      // Verify branch is soft deleted
      const deletedBranch = (await knex('branches')
        .where('id', testBranch.id)
        .first()) as BranchRecord;
      expect(deletedBranch.status).toBe('Deleted');
    });

    it('should enforce unique constraints', async (): Promise<void> => {
      // Test name uniqueness
      try {
        await knex('branches').insert({
          id: knex.raw('gen_random_uuid()'),
          name_uz: testBranch.name_uz,
          name_ru: testBranch.name_ru,
          name_en: testBranch.name_en,
          address_uz: 'Different Address',
          support_phone: '+998998877665',
          status: 'Open',
          sort: 999,
          created_at: new Date(),
          updated_at: new Date(),
        });
        throw new Error('Should have thrown unique constraint error');
      } catch (error) {
        const pgError = error as { code: string };
        expect(pgError.code).toBe('23505'); // PostgreSQL unique constraint violation
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent branch creation requests', async (): Promise<void> => {
      const promises: Promise<request.Response>[] = [];
      const branchCount = 10;

      for (let i = 0; i < branchCount; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/branches')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name_uz: `Concurrent Branch ${i}`,
            name_ru: `Concurrent Branch ${i}`,
            name_en: `Concurrent Branch ${i}`,
            address_uz: `${i} Concurrent Street`,
            support_phone: `+99890${4000 + i}`,
          });
        promises.push(promise as unknown as Promise<request.Response>);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(
        (r): r is PromiseFulfilledResult<request.Response> =>
          r.status === 'fulfilled' && r.value.status === 201,
      );

      expect(successful.length).toBe(branchCount);
    });

    it('should handle large paginated requests efficiently', async (): Promise<void> => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/branches?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  afterEach(async (): Promise<void> => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
