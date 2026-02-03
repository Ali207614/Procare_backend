import { Test, TestingModule } from '@nestjs/testing';
import { Knex, knex } from 'knex';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { AdminsService } from '../src/admins/admins.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../src/common/redis/redis.service';
import { TestHelpers } from './utils/test-helpers';
import { AdminFactory } from './factories/admin.factory';
import { BranchFactory } from './factories/branch.factory';
import { RoleFactory } from './factories/role.factory';

describe('Auth Service Integration Tests', () => {
  let authService: AuthService;
  let adminsService: AdminsService;
  let knexInstance: Knex;
  let redisClient: Redis;
  let jwtService: JwtService;
  let redisService: RedisService;

  beforeAll(async () => {
    try {
      // Setup real database connection
      knexInstance = knex({
        client: 'pg',
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5433,
          user: process.env.DB_USER || 'test_user',
          password: process.env.DB_PASS || 'test_pass',
          database: process.env.DB_NAME || 'repair_order_test',
        },
        pool: { min: 2, max: 10 },
      });

      // Setup Redis connection
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6380,
      });

      // Test connections
      await knexInstance.raw('SELECT 1');
      await redisClient.ping();

      // Create RedisService instance
      redisService = new RedisService(redisClient, { log: () => {}, error: () => {} } as any);

      // Create JWT service
      jwtService = new JwtService({
        secret: process.env.JWT_SECRET || 'test-secret',
        signOptions: { expiresIn: '24h' },
      });
    } catch (error) {
      console.warn('Database/Redis connection failed:', error.message);
    }
  });

  beforeEach(async () => {
    if (!knexInstance || !redisClient) {
      return;
    }

    try {
      // Clean database and Redis
      await TestHelpers.cleanDatabase(knexInstance);
      await redisClient.flushdb();

      // Create test module
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          AdminsService,
          {
            provide: 'default_KnexModuleConnectionToken',
            useValue: knexInstance,
          },
          {
            provide: RedisService,
            useValue: redisService,
          },
          {
            provide: JwtService,
            useValue: jwtService,
          },
          {
            provide: 'PermissionsService',
            useValue: {
              findAll: jest.fn().mockResolvedValue([]),
              getPermissions: jest.fn().mockResolvedValue(['admin.read', 'admin.write']),
            },
          },
        ],
      }).compile();

      authService = module.get<AuthService>(AuthService);
      adminsService = module.get<AdminsService>(AdminsService);

      // Seed test data
      await TestHelpers.seedTestData(knexInstance);
    } catch (error) {
      console.warn('Test setup failed:', error.message);
    }
  });

  afterAll(async () => {
    try {
      if (knexInstance) {
        await TestHelpers.cleanDatabase(knexInstance);
        await knexInstance.destroy();
      }
      if (redisClient) {
        await redisClient.quit();
      }
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  });

  describe('Complete Authentication Flow', () => {
    it('should complete admin registration and login flow', async () => {
      if (!knexInstance || !redisClient) {
        console.warn('Integration test skipped - database not available');
        return;
      }

      try {
        // 1. Create test admin in pending status
        const branch = BranchFactory.create();
        const role = RoleFactory.createAdminRole();

        await knexInstance('branches').insert(branch);
        await knexInstance('roles').insert(role);

        const pendingAdmin = AdminFactory.create({
          status: 'Pending',
          branch_id: branch.id,
          role_id: role.id,
          password: null,
        });
        await knexInstance('admins').insert(pendingAdmin);

        // 2. Send verification code
        const codeResponse = await authService.sendVerificationCode({
          phone_number: pendingAdmin.phone,
        });

        expect(codeResponse).toHaveProperty('message');
        expect(codeResponse).toHaveProperty('code');
        expect(codeResponse.code).toHaveLength(6);

        // Verify code is stored in Redis
        const storedCode = await redisClient.get(`verification-code:${pendingAdmin.phone}`);
        expect(storedCode).toBe(codeResponse.code);

        // 3. Verify admin with code and set password
        const verifyResponse = await authService.verifyAdmin({
          phone_number: pendingAdmin.phone,
          verification_code: codeResponse.code,
          password: 'testPassword123',
        });

        expect(verifyResponse).toHaveProperty('access_token');
        expect(verifyResponse).toHaveProperty('admin');
        expect(verifyResponse.admin.status).toBe('Active');

        // Verify password was set
        const updatedAdmin = await knexInstance('admins').where('id', pendingAdmin.id).first();
        expect(updatedAdmin.password).toBeTruthy();
        expect(updatedAdmin.status).toBe('Active');

        // Verify code was removed from Redis
        const codeAfterVerify = await redisClient.get(`verification-code:${pendingAdmin.phone}`);
        expect(codeAfterVerify).toBeNull();

        // 4. Login with credentials
        const loginResponse = await authService.loginAdmin({
          phone_number: pendingAdmin.phone,
          password: 'testPassword123',
        });

        expect(loginResponse).toHaveProperty('access_token');
        expect(loginResponse).toHaveProperty('admin');
        expect(loginResponse.admin.id).toBe(pendingAdmin.id);

        // Verify session is stored
        const sessionKey = `session:admin:${pendingAdmin.id}`;
        const sessionToken = await redisClient.get(sessionKey);
        expect(sessionToken).toBeTruthy();

        // 5. Test password reset flow
        const resetResponse = await authService.forgotPassword({
          phone_number: pendingAdmin.phone,
        });

        expect(resetResponse).toHaveProperty('reset_code');

        // 6. Reset password
        const resetPasswordResponse = await authService.resetPassword({
          phone_number: pendingAdmin.phone,
          reset_code: resetResponse.reset_code,
          new_password: 'newPassword123',
        });

        expect(resetPasswordResponse).toHaveProperty('message');

        // 7. Login with new password
        const newLoginResponse = await authService.loginAdmin({
          phone_number: pendingAdmin.phone,
          password: 'newPassword123',
        });

        expect(newLoginResponse).toHaveProperty('access_token');
      } catch (error) {
        if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
          console.warn('Integration test skipped - database/Redis not available');
          return;
        }
        throw error;
      }
    });

    it('should handle password change flow', async () => {
      if (!knexInstance || !redisClient) {
        console.warn('Integration test skipped - database not available');
        return;
      }

      try {
        // Create active admin with password
        const hashedPassword = await bcrypt.hash('currentPassword123', 10);
        const admin = AdminFactory.create({
          status: 'Active',
          password: hashedPassword,
        });
        await knexInstance('admins').insert(admin);

        // Change password
        const changeResponse = await authService.changePassword(admin.id, {
          current_password: 'currentPassword123',
          new_password: 'newPassword456',
        });

        expect(changeResponse).toHaveProperty('message');

        // Verify password was changed
        const updatedAdmin = await knexInstance('admins').where('id', admin.id).first();

        const passwordMatches = await bcrypt.compare('newPassword456', updatedAdmin.password);
        expect(passwordMatches).toBe(true);
      } catch (error) {
        if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
          console.warn('Integration test skipped - database not available');
          return;
        }
        throw error;
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid verification codes', async () => {
      if (!knexInstance || !redisClient) {
        return;
      }

      try {
        const admin = AdminFactory.create({ status: 'Pending' });
        await knexInstance('admins').insert(admin);

        // Try to verify with invalid code
        await expect(
          authService.verifyAdmin({
            phone_number: admin.phone,
            verification_code: '000000',
            password: 'testPassword123',
          }),
        ).rejects.toThrow();
      } catch (error) {
        if (error.message.includes('connect')) {
          console.warn('Integration test skipped - database not available');
          return;
        }
        throw error;
      }
    });

    it('should handle expired codes', async () => {
      if (!knexInstance || !redisClient) {
        return;
      }

      try {
        const admin = AdminFactory.create({ status: 'Pending' });
        await knexInstance('admins').insert(admin);

        // Set expired code in Redis (TTL = 1 second)
        const expiredCode = '123456';
        await redisClient.setex(`verification-code:${admin.phone}`, 1, expiredCode);

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 1100));

        // Try to verify with expired code
        await expect(
          authService.verifyAdmin({
            phone_number: admin.phone,
            verification_code: expiredCode,
            password: 'testPassword123',
          }),
        ).rejects.toThrow();
      } catch (error) {
        if (error.message.includes('connect')) {
          console.warn('Integration test skipped - database not available');
          return;
        }
        throw error;
      }
    });
  });

  describe('Redis Session Management', () => {
    it('should manage sessions correctly', async () => {
      if (!knexInstance || !redisClient) {
        return;
      }

      try {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const admin = AdminFactory.create({
          status: 'Active',
          password: hashedPassword,
        });
        await knexInstance('admins').insert(admin);

        // Login
        const loginResponse = await authService.loginAdmin({
          phone_number: admin.phone,
          password: 'password123',
        });

        // Check session exists
        const sessionKey = `session:admin:${admin.id}`;
        const sessionToken = await redisClient.get(sessionKey);
        expect(sessionToken).toBeTruthy();

        // Login again (should update session)
        const secondLoginResponse = await authService.loginAdmin({
          phone_number: admin.phone,
          password: 'password123',
        });

        const newSessionToken = await redisClient.get(sessionKey);
        expect(newSessionToken).toBeTruthy();
        expect(newSessionToken).not.toBe(sessionToken);
      } catch (error) {
        if (error.message.includes('connect')) {
          console.warn('Integration test skipped - database not available');
          return;
        }
        throw error;
      }
    });
  });
});
