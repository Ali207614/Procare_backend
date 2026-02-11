import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PhoneCategoriesService } from '../src/phone-categories/phone-categories.service';
import { AuthService } from '../src/auth/auth.service';
import { TestModuleBuilder } from './utils/test-module-builder';
import { CoverageHelpers } from './utils/coverage-helpers';

describe('Phone Categories Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let phoneCategoriesService: PhoneCategoriesService;
  let knex: any;
  let redis: any;
  let adminToken: string;
  let limitedAdminToken: string;
  let testAdmin: any;
  let limitedAdmin: any;
  let testBranch: any;
  let testOsType: any;
  let testPhoneCategory: any;
  let childPhoneCategory: any;
  let secondPhoneCategory: any;

  beforeAll(async () => {
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
    phoneCategoriesService = module.get<PhoneCategoriesService>(PhoneCategoriesService);
    knex = module.get('KNEX_CONNECTION');
    redis = module.get('REDIS_CLIENT');

    // Clean database and cache
    await knex.raw('DELETE FROM phone_categories');
    await knex.raw('DELETE FROM phone_os_types');
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

  afterAll(async () => {
    // Clean up
    await knex.raw('DELETE FROM phone_categories');
    await knex.raw('DELETE FROM phone_os_types');
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

  async function setupTestData() {
    // Create test branch
    testBranch = await knex('branches')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Branch',
        address: 'Test Address',
        phone: '+998901234567',
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testBranch = testBranch[0];

    // Create phone category permissions
    const phoneCategoryPermissions = [
      'phone.category.create',
      'phone.category.view',
      'phone.category.update',
      'phone.category.delete',
    ];

    for (const permission of phoneCategoryPermissions) {
      await knex('permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        name: permission,
        description: `Permission for ${permission}`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test role with all phone category permissions
    const testRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Phone Category Manager Role',
        description: 'Role for managing phone categories',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const role = testRole[0];

    // Create limited role with only view permission
    const limitedRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Limited Role',
        description: 'Role with limited permissions',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const limitedRoleRecord = limitedRole[0];

    // Assign permissions to roles
    const allPermissions = await knex('permissions').select('*');
    for (const permission of allPermissions) {
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: role.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Only assign view permission to limited role
      if (permission.name === 'phone.category.view') {
        await knex('role_permissions').insert({
          id: knex.raw('gen_random_uuid()'),
          role_id: limitedRoleRecord.id,
          permission_id: permission.id,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    // Create test OS type
    testOsType = await knex('phone_os_types')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test OS',
        sort: 1,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testOsType = testOsType[0];

    // Create test phone categories
    testPhoneCategory = await knex('phone_categories')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Phone Category',
        phone_os_type_id: testOsType.id,
        parent_id: null,
        sort: 1,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testPhoneCategory = testPhoneCategory[0];

    childPhoneCategory = await knex('phone_categories')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Child Phone Category',
        phone_os_type_id: testOsType.id,
        parent_id: testPhoneCategory.id,
        sort: 1,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    childPhoneCategory = childPhoneCategory[0];

    secondPhoneCategory = await knex('phone_categories')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Second Phone Category',
        phone_os_type_id: testOsType.id,
        parent_id: null,
        sort: 2,
        status: 'Inactive',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondPhoneCategory = secondPhoneCategory[0];

    // Create test admins
    testAdmin = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Test',
        last_name: 'Admin',
        phone: '+998901111111',
        login: 'testadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testAdmin = testAdmin[0];

    limitedAdmin = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Limited',
        last_name: 'Admin',
        phone: '+998902222222',
        login: 'limitedadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    limitedAdmin = limitedAdmin[0];

    // Assign roles to admins
    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: testAdmin.id,
      role_id: role.id,
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
      login: testAdmin.login,
      first_name: testAdmin.first_name,
      last_name: testAdmin.last_name,
      phone: testAdmin.phone,
      branch_id: testAdmin.branch_id,
      status: testAdmin.status,
    });

    limitedAdminToken = authService.generateJwtToken({
      id: limitedAdmin.id,
      login: limitedAdmin.login,
      first_name: limitedAdmin.first_name,
      last_name: limitedAdmin.last_name,
      phone: limitedAdmin.phone,
      branch_id: limitedAdmin.branch_id,
      status: limitedAdmin.status,
    });
  }

  describe('POST /api/v1/phone-categories (Create Phone Category)', () => {
    it('should create phone category successfully with proper permissions', async () => {
      const newCategoryData = {
        name: 'New Phone Category',
        phone_os_type_id: testOsType.id,
        parent_id: null,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCategoryData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: newCategoryData.name,
        phone_os_type_id: newCategoryData.phone_os_type_id,
        parent_id: null,
        sort: expect.any(Number),
        status: 'Active',
      });

      // Verify category was created in database
      const createdCategory = await knex('phone_categories').where('id', response.body.id).first();
      expect(createdCategory).toBeTruthy();
      expect(createdCategory.name).toBe(newCategoryData.name);
    });

    it('should create child phone category', async () => {
      const childCategoryData = {
        name: 'New Child Category',
        phone_os_type_id: testOsType.id,
        parent_id: testPhoneCategory.id,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(childCategoryData)
        .expect(201);

      expect(response.body.parent_id).toBe(testPhoneCategory.id);
    });

    it('should fail with duplicate category name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testPhoneCategory.name, // Same name as existing category
          phone_os_type_id: testOsType.id,
          parent_id: null,
        })
        .expect(400);
    });

    it('should fail with invalid phone_os_type_id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid OS Type Category',
          phone_os_type_id: '00000000-0000-4000-8000-000000000000',
          parent_id: null,
        })
        .expect(400);
    });

    it('should fail with invalid parent_id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Parent Category',
          phone_os_type_id: testOsType.id,
          parent_id: '00000000-0000-4000-8000-000000000000',
        })
        .expect(400);
    });

    it('should fail with invalid data validation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Empty name
          phone_os_type_id: 'invalid-uuid',
          parent_id: null,
        })
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name: 'Unauthorized Category',
          phone_os_type_id: testOsType.id,
          parent_id: null,
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/phone-categories')
        .send({
          name: 'No Auth Category',
          phone_os_type_id: testOsType.id,
          parent_id: null,
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/phone-categories (Get All Phone Categories)', () => {
    beforeEach(async () => {
      // Create additional categories for testing
      for (let i = 1; i <= 3; i++) {
        await knex('phone_categories').insert({
          id: knex.raw('gen_random_uuid()'),
          name: `Additional Category ${i}`,
          phone_os_type_id: testOsType.id,
          parent_id: null,
          sort: i + 10,
          status: 'Active',
          created_at: new Date(Date.now() - i * 3600000),
          updated_at: new Date(),
        });
      }
    });

    it('should return all root categories by default', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        meta: {
          total: expect.any(Number),
          limit: expect.any(Number),
          offset: expect.any(Number),
        },
      });

      // Should return root categories (parent_id is null)
      response.body.data.forEach((category) => {
        expect(category.parent_id).toBeNull();
      });
    });

    it('should filter categories by phone_os_type_id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/phone-categories?phone_os_type_id=${testOsType.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.data.forEach((category) => {
        expect(category.phone_os_type_id).toBe(testOsType.id);
      });
    });

    it('should return child categories by parent_id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/phone-categories?parent_id=${testPhoneCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].parent_id).toBe(testPhoneCategory.id);
      expect(response.body.data[0].name).toBe('Child Phone Category');
    });

    it('should search categories by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/phone-categories?search=Test Phone Category')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      const foundCategory = response.body.data.find((cat) => cat.name === 'Test Phone Category');
      expect(foundCategory).toBeTruthy();
    });

    it('should paginate results correctly', async () => {
      const limit = 2;
      const offset = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/phone-categories?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should return categories sorted by sort field', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/phone-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.data.length > 1) {
        const sorts = response.body.data.map((cat) => cat.sort);
        const sortedSorts = [...sorts].sort((a, b) => a - b);
        expect(sorts).toEqual(sortedSorts);
      }
    });

    it('should handle combined filters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/phone-categories?phone_os_type_id=${testOsType.id}&parent_id=null&limit=3`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(3);
      response.body.data.forEach((category) => {
        expect(category.phone_os_type_id).toBe(testOsType.id);
        expect(category.parent_id).toBeNull();
      });
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/phone-categories?search=NonExistentCategory')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/phone-categories').expect(401);
    });
  });

  describe('PATCH /api/v1/phone-categories/:id/sort (Update Category Sort)', () => {
    it('should update category sort successfully', async () => {
      const newSort = 100;

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${testPhoneCategory.id}/sort`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: newSort })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Sort updated successfully',
      });

      // Verify sort was updated in database
      const updatedCategory = await knex('phone_categories')
        .where('id', testPhoneCategory.id)
        .first();
      expect(updatedCategory.sort).toBe(newSort);
    });

    it('should fail with invalid sort value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${testPhoneCategory.id}/sort`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: -1 })
        .expect(400);
    });

    it('should fail when updating non-existent category', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/phone-categories/00000000-0000-4000-8000-000000000000/sort')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: 50 })
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${testPhoneCategory.id}/sort`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({ sort: 50 })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${testPhoneCategory.id}/sort`)
        .send({ sort: 50 })
        .expect(401);
    });
  });

  describe('PATCH /api/v1/phone-categories/:id (Update Phone Category)', () => {
    it('should update category successfully', async () => {
      const updateData = {
        name: 'Updated Category Name',
        status: 'Inactive',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${secondPhoneCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Phone category updated successfully',
      });

      // Verify category was updated in database
      const updatedCategory = await knex('phone_categories')
        .where('id', secondPhoneCategory.id)
        .first();
      expect(updatedCategory.name).toBe(updateData.name);
      expect(updatedCategory.status).toBe(updateData.status);
    });

    it('should update partial category data', async () => {
      const updateData = {
        name: 'Partially Updated Category',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${testPhoneCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Phone category updated successfully',
      });

      // Verify only specified field was updated
      const updatedCategory = await knex('phone_categories')
        .where('id', testPhoneCategory.id)
        .first();
      expect(updatedCategory.name).toBe(updateData.name);
      expect(updatedCategory.status).toBe(testPhoneCategory.status); // Should remain unchanged
    });

    it('should fail when updating non-existent category', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/phone-categories/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non-existent Category',
        })
        .expect(404);
    });

    it('should fail with duplicate name', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${secondPhoneCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testPhoneCategory.name, // Trying to use existing name
        })
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${testPhoneCategory.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/phone-categories/${testPhoneCategory.id}`)
        .send({
          name: 'No Auth Update',
        })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/phone-categories/:id (Delete Phone Category)', () => {
    beforeEach(async () => {
      // Create a category specifically for deletion testing
      const deleteCategory = await knex('phone_categories')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Delete Test Category',
          phone_os_type_id: testOsType.id,
          parent_id: null,
          sort: 999,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      this.deleteCategoryId = deleteCategory[0].id;
    });

    it('should delete category successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/phone-categories/${this.deleteCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Phone category deleted successfully',
      });

      // Verify category was soft deleted in database
      const deletedCategory = await knex('phone_categories')
        .where('id', this.deleteCategoryId)
        .first();
      expect(deletedCategory.deleted_at).toBeTruthy();
    });

    it('should fail when deleting non-existent category', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/phone-categories/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail when trying to delete already deleted category', async () => {
      // Delete category first
      await request(app.getHttpServer())
        .delete(`/api/v1/phone-categories/${this.deleteCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Try to delete again
      await request(app.getHttpServer())
        .delete(`/api/v1/phone-categories/${this.deleteCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/phone-categories/${this.deleteCategoryId}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/phone-categories/${this.deleteCategoryId}`)
        .expect(401);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity', async () => {
      const categories = await knex('phone_categories').select('*');
      const osTypes = await knex('phone_os_types').select('*');

      for (const category of categories) {
        const osType = osTypes.find((os) => os.id === category.phone_os_type_id);
        expect(osType).toBeTruthy();

        if (category.parent_id) {
          const parent = categories.find((c) => c.id === category.parent_id);
          expect(parent).toBeTruthy();
        }
      }
    });

    it('should maintain audit fields correctly', async () => {
      const categories = await knex('phone_categories').select('*');

      for (const category of categories) {
        expect(category.created_at).toBeTruthy();
        expect(category.updated_at).toBeTruthy();
        expect(new Date(category.created_at)).toBeInstanceOf(Date);
        expect(new Date(category.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should properly handle soft deletes', async () => {
      // Soft delete a category
      await phoneCategoriesService.delete(secondPhoneCategory.id);

      // Verify category is soft deleted
      const deletedCategory = await knex('phone_categories')
        .where('id', secondPhoneCategory.id)
        .first();
      expect(deletedCategory.deleted_at).toBeTruthy();

      // Verify category doesn't appear in active queries
      const activeCategories = await knex('phone_categories').whereNull('deleted_at');
      expect(activeCategories.find((c) => c.id === secondPhoneCategory.id)).toBeFalsy();
    });

    it('should enforce unique constraints', async () => {
      try {
        await knex('phone_categories').insert({
          id: knex.raw('gen_random_uuid()'),
          name: testPhoneCategory.name, // Duplicate name
          phone_os_type_id: testOsType.id,
          parent_id: null,
          sort: 999,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        });
        fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.code).toBe('23505'); // PostgreSQL unique constraint violation
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent category creation requests', async () => {
      const promises = [];
      const categoryCount = 5;

      for (let i = 0; i < categoryCount; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/phone-categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Concurrent Category ${i}`,
            phone_os_type_id: testOsType.id,
            parent_id: null,
          });
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 201);

      expect(successful.length).toBe(categoryCount);
    });

    it('should handle large paginated requests efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/phone-categories?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent unauthorized access to protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'post', path: '/api/v1/phone-categories' },
        { method: 'patch', path: `/api/v1/phone-categories/${testPhoneCategory.id}` },
        { method: 'delete', path: `/api/v1/phone-categories/${testPhoneCategory.id}` },
        { method: 'patch', path: `/api/v1/phone-categories/${testPhoneCategory.id}/sort` },
      ];

      for (const endpoint of protectedEndpoints) {
        await request(app.getHttpServer())[endpoint.method](endpoint.path).expect(401);
      }
    });

    it('should validate admin permissions for each operation', async () => {
      const protectedEndpoints = [
        { method: 'post', path: '/api/v1/phone-categories', data: {} },
        { method: 'patch', path: `/api/v1/phone-categories/${testPhoneCategory.id}`, data: {} },
        { method: 'delete', path: `/api/v1/phone-categories/${testPhoneCategory.id}` },
        {
          method: 'patch',
          path: `/api/v1/phone-categories/${testPhoneCategory.id}/sort`,
          data: { sort: 1 },
        },
      ];

      for (const endpoint of protectedEndpoints) {
        const req = request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${limitedAdminToken}`);

        if (endpoint.data) {
          req.send(endpoint.data);
        }

        await req.expect(403);
      }
    });

    it('should validate JWT token format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/phone-categories')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
