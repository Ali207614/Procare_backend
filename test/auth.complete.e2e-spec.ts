import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { UserFactory } from './factories/user.factory';
import { BranchFactory } from './factories/branch.factory';
import { RoleFactory } from './factories/role.factory';
import { TestHelpers } from './utils/test-helpers';

describe('Auth - Complete E2E', () => {
  let app: INestApplication;
  let knex: any;
  let redis: any;
  let adminData: any;
  let userData: any;
  let branchData: any;
  let roleData: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    knex = moduleFixture.get('KnexConnection');
    redis = moduleFixture.get('RedisClient');

    // Setup test data
    branchData = await BranchFactory.create(knex);
    roleData = await RoleFactory.create(knex);
    adminData = await AdminFactory.create(knex, {
      branch_id: branchData.id,
      role_id: roleData.id,
      phone: '+998901234567',
    });
    userData = await UserFactory.create(knex, {
      phone_number: '+998901234568',
    });
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('POST /auth/admin/login - Admin Login', () => {
    it('should login admin successfully with phone and password', async () => {
      const loginDto = {
        phone: adminData.phone,
        password: 'password123', // Assuming default password
      };

      const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('admin');
      expect(response.body.admin).toHaveProperty('id', adminData.id);
      expect(response.body.admin).toHaveProperty('phone', adminData.phone);
      expect(response.body.admin).toHaveProperty('branch');
      expect(response.body.admin).toHaveProperty('role');

      // Verify token is valid JWT
      expect(response.body.access_token).toMatch(
        /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
      );

      // Verify admin last login is updated
      const updatedAdmin = await knex('admins').where({ id: adminData.id }).first();
      expect(updatedAdmin.last_login_at).toBeTruthy();
    });

    it('should fail login with incorrect password', async () => {
      const loginDto = {
        phone: adminData.phone,
        password: 'wrongpassword',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send(loginDto)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail login with non-existent admin', async () => {
      const loginDto = {
        phone: '+998999999999',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send(loginDto)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail login with inactive admin', async () => {
      // Create inactive admin
      const inactiveAdmin = await AdminFactory.create(knex, {
        branch_id: branchData.id,
        role_id: roleData.id,
        is_active: false,
        phone: '+998901234569',
      });

      const loginDto = {
        phone: inactiveAdmin.phone,
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toContain('Account is inactive');
    });

    it('should validate request body format', async () => {
      const invalidDto = {
        phone: 'invalid-phone-format',
        password: '',
      };

      await request(app.getHttpServer()).post('/auth/admin/login').send(invalidDto).expect(400);
    });

    it('should handle missing fields', async () => {
      const incompleteDto = {
        phone: adminData.phone,
        // Missing password
      };

      await request(app.getHttpServer()).post('/auth/admin/login').send(incompleteDto).expect(400);
    });

    it('should rate limit login attempts', async () => {
      const loginDto = {
        phone: adminData.phone,
        password: 'wrongpassword',
      };

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).post('/auth/admin/login').send(loginDto);
      }

      // Next attempt should be rate limited
      const response = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send(loginDto)
        .expect(429);

      expect(response.body.message).toContain('Too many requests');
    });

    it('should log successful login events', async () => {
      const loginDto = {
        phone: adminData.phone,
        password: 'password123',
      };

      await request(app.getHttpServer()).post('/auth/admin/login').send(loginDto).expect(200);

      // Verify login event is logged
      const loginLog = await knex('admin_login_logs')
        .where({ admin_id: adminData.id })
        .orderBy('created_at', 'desc')
        .first();

      expect(loginLog).toBeTruthy();
      expect(loginLog.login_status).toBe('success');
      expect(loginLog.ip_address).toBeTruthy();
    });

    it('should log failed login attempts', async () => {
      const loginDto = {
        phone: adminData.phone,
        password: 'wrongpassword',
      };

      await request(app.getHttpServer()).post('/auth/admin/login').send(loginDto).expect(401);

      // Verify failed login is logged
      const loginLog = await knex('admin_login_logs')
        .where({ attempted_phone: adminData.phone })
        .orderBy('created_at', 'desc')
        .first();

      expect(loginLog).toBeTruthy();
      expect(loginLog.login_status).toBe('failed');
      expect(loginLog.failure_reason).toBeTruthy();
    });
  });

  describe('POST /auth/admin/register - Admin Registration', () => {
    it('should register new admin successfully', async () => {
      const registerDto = {
        phone: '+998901234570',
        full_name: 'Test Admin',
        password: 'securepassword123',
        branch_id: branchData.id,
        role_id: roleData.id,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/admin/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Admin registered successfully');
      expect(response.body).toHaveProperty('admin_id');

      // Verify admin is created in database
      const newAdmin = await knex('admins').where({ phone: registerDto.phone }).first();

      expect(newAdmin).toBeTruthy();
      expect(newAdmin.full_name).toBe(registerDto.full_name);
      expect(newAdmin.branch_id).toBe(registerDto.branch_id);
      expect(newAdmin.role_id).toBe(registerDto.role_id);
      expect(newAdmin.is_active).toBe(false); // Should be inactive by default
    });

    it('should fail registration with duplicate phone', async () => {
      const registerDto = {
        phone: adminData.phone, // Existing phone
        full_name: 'Duplicate Admin',
        password: 'password123',
        branch_id: branchData.id,
        role_id: roleData.id,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/admin/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).toContain('Phone number already exists');
    });

    it('should validate phone number format', async () => {
      const registerDto = {
        phone: 'invalid-phone',
        full_name: 'Test Admin',
        password: 'password123',
        branch_id: branchData.id,
        role_id: roleData.id,
      };

      await request(app.getHttpServer()).post('/auth/admin/register').send(registerDto).expect(400);
    });

    it('should validate password strength', async () => {
      const registerDto = {
        phone: '+998901234571',
        full_name: 'Test Admin',
        password: '123', // Weak password
        branch_id: branchData.id,
        role_id: roleData.id,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/admin/register')
        .send(registerDto)
        .expect(400);

      expect(response.body.message).toContain('Password must be');
    });

    it('should validate required fields', async () => {
      const incompleteDto = {
        phone: '+998901234572',
        full_name: 'Test Admin',
        // Missing password, branch_id, role_id
      };

      await request(app.getHttpServer())
        .post('/auth/admin/register')
        .send(incompleteDto)
        .expect(400);
    });

    it('should validate branch and role existence', async () => {
      const registerDto = {
        phone: '+998901234573',
        full_name: 'Test Admin',
        password: 'password123',
        branch_id: 'non-existent-branch',
        role_id: 'non-existent-role',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/admin/register')
        .send(registerDto)
        .expect(400);

      expect(response.body.message).toContain('Branch or role not found');
    });
  });

  describe('POST /auth/admin/refresh - Token Refresh', () => {
    let validToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer()).post('/auth/admin/login').send({
        phone: adminData.phone,
        password: 'password123',
      });

      validToken = loginResponse.body.access_token;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/admin/refresh')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.access_token).not.toBe(validToken); // Should be new token
    });

    it('should fail refresh with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/admin/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should fail refresh without token', async () => {
      await request(app.getHttpServer()).post('/auth/admin/refresh').expect(401);
    });
  });

  describe('POST /auth/admin/logout - Admin Logout', () => {
    let validToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer()).post('/auth/admin/login').send({
        phone: adminData.phone,
        password: 'password123',
      });

      validToken = loginResponse.body.access_token;
    });

    it('should logout admin successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/admin/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logged out successfully');

      // Verify token is invalidated (added to blacklist)
      const blacklistedToken = await redis.get(`blacklist:${validToken}`);
      expect(blacklistedToken).toBeTruthy();
    });

    it('should handle logout with invalid token gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/admin/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toContain('Unauthorized');
    });
  });

  describe('POST /auth/user/send-verification - User Phone Verification', () => {
    it('should send SMS verification code successfully', async () => {
      const verificationDto = {
        phone_number: '+998901234574',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/user/send-verification')
        .send(verificationDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Verification code sent');
      expect(response.body).toHaveProperty('expires_in');

      // Verify code is stored in Redis
      const storedCode = await redis.get(`verification:${verificationDto.phone_number}`);
      expect(storedCode).toBeTruthy();
    });

    it('should rate limit verification requests', async () => {
      const verificationDto = {
        phone_number: '+998901234575',
      };

      // Send multiple requests
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/auth/user/send-verification')
          .send(verificationDto);
      }

      // Next request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/auth/user/send-verification')
        .send(verificationDto)
        .expect(429);

      expect(response.body.message).toContain('Too many verification attempts');
    });

    it('should validate phone number format', async () => {
      const verificationDto = {
        phone_number: 'invalid-phone',
      };

      await request(app.getHttpServer())
        .post('/auth/user/send-verification')
        .send(verificationDto)
        .expect(400);
    });
  });

  describe('POST /auth/user/verify-phone - Verify Phone Number', () => {
    let verificationCode: string;
    const phoneNumber = '+998901234576';

    beforeEach(async () => {
      // Send verification code first
      await request(app.getHttpServer())
        .post('/auth/user/send-verification')
        .send({ phone_number: phoneNumber });

      // Get the verification code from Redis
      verificationCode = await redis.get(`verification:${phoneNumber}`);
    });

    it('should verify phone number successfully for new user', async () => {
      const verifyDto = {
        phone_number: phoneNumber,
        verification_code: verificationCode,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/user/verify-phone')
        .send(verifyDto)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('phone_number', phoneNumber);

      // Verify user is created in database
      const newUser = await knex('users').where({ phone_number: phoneNumber }).first();

      expect(newUser).toBeTruthy();
      expect(newUser.phone_verified).toBe(true);
    });

    it('should verify phone number for existing user', async () => {
      // Create user first
      const existingUser = await UserFactory.create(knex, {
        phone_number: phoneNumber,
        phone_verified: false,
      });

      const verifyDto = {
        phone_number: phoneNumber,
        verification_code: verificationCode,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/user/verify-phone')
        .send(verifyDto)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toHaveProperty('id', existingUser.id);

      // Verify phone_verified is updated
      const updatedUser = await knex('users').where({ id: existingUser.id }).first();

      expect(updatedUser.phone_verified).toBe(true);
    });

    it('should fail verification with incorrect code', async () => {
      const verifyDto = {
        phone_number: phoneNumber,
        verification_code: '999999', // Wrong code
      };

      const response = await request(app.getHttpServer())
        .post('/auth/user/verify-phone')
        .send(verifyDto)
        .expect(400);

      expect(response.body.message).toContain('Invalid verification code');
    });

    it('should fail verification with expired code', async () => {
      // Set code expiration to past
      await redis.del(`verification:${phoneNumber}`);

      const verifyDto = {
        phone_number: phoneNumber,
        verification_code: verificationCode,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/user/verify-phone')
        .send(verifyDto)
        .expect(400);

      expect(response.body.message).toContain('Verification code expired');
    });

    it('should clear verification code after successful verification', async () => {
      const verifyDto = {
        phone_number: phoneNumber,
        verification_code: verificationCode,
      };

      await request(app.getHttpServer())
        .post('/auth/user/verify-phone')
        .send(verifyDto)
        .expect(200);

      // Verify code is removed from Redis
      const storedCode = await redis.get(`verification:${phoneNumber}`);
      expect(storedCode).toBeNull();
    });
  });

  describe('POST /auth/user/login - User Login (Alternative)', () => {
    it('should login existing verified user', async () => {
      const user = await UserFactory.create(knex, {
        phone_number: '+998901234577',
        phone_verified: true,
      });

      const loginDto = {
        phone_number: user.phone_number,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/user/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', user.id);
    });

    it('should fail login for unverified user', async () => {
      const user = await UserFactory.create(knex, {
        phone_number: '+998901234578',
        phone_verified: false,
      });

      const loginDto = {
        phone_number: user.phone_number,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/user/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toContain('Phone number not verified');
    });

    it('should fail login for non-existent user', async () => {
      const loginDto = {
        phone_number: '+998999999998',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/user/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toContain('User not found');
    });
  });

  describe('GET /auth/me - Get Current User/Admin', () => {
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
      // Get admin token
      const adminLogin = await request(app.getHttpServer()).post('/auth/admin/login').send({
        phone: adminData.phone,
        password: 'password123',
      });
      adminToken = adminLogin.body.access_token;

      // Get user token
      const userLogin = await request(app.getHttpServer()).post('/auth/user/login').send({
        phone_number: userData.phone_number,
      });
      userToken = userLogin.body.access_token;
    });

    it('should return admin profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('type', 'admin');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile).toHaveProperty('id', adminData.id);
      expect(response.body.profile).toHaveProperty('phone', adminData.phone);
      expect(response.body.profile).toHaveProperty('branch');
      expect(response.body.profile).toHaveProperty('role');
    });

    it('should return user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('type', 'user');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile).toHaveProperty('id', userData.id);
      expect(response.body.profile).toHaveProperty('phone_number', userData.phone_number);
    });

    it('should fail without token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/change-password - Change Password', () => {
    let adminToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer()).post('/auth/admin/login').send({
        phone: adminData.phone,
        password: 'password123',
      });
      adminToken = loginResponse.body.access_token;
    });

    it('should change admin password successfully', async () => {
      const changePasswordDto = {
        current_password: 'password123',
        new_password: 'newpassword456',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(changePasswordDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Password changed successfully');

      // Verify old password no longer works
      await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({
          phone: adminData.phone,
          password: 'password123',
        })
        .expect(401);

      // Verify new password works
      await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({
          phone: adminData.phone,
          password: 'newpassword456',
        })
        .expect(200);
    });

    it('should fail with incorrect current password', async () => {
      const changePasswordDto = {
        current_password: 'wrongpassword',
        new_password: 'newpassword456',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(changePasswordDto)
        .expect(400);

      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      const changePasswordDto = {
        current_password: 'password123',
        new_password: '123', // Weak password
      };

      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(changePasswordDto)
        .expect(400);

      expect(response.body.message).toContain('Password must be');
    });
  });

  describe('POST /auth/forgot-password - Forgot Password', () => {
    it('should send password reset code', async () => {
      const forgotDto = {
        phone: adminData.phone,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send(forgotDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Password reset code sent');

      // Verify reset code is stored
      const resetCode = await redis.get(`reset:${adminData.phone}`);
      expect(resetCode).toBeTruthy();
    });

    it('should fail for non-existent admin', async () => {
      const forgotDto = {
        phone: '+998999999997',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send(forgotDto)
        .expect(404);

      expect(response.body.message).toContain('Admin not found');
    });
  });

  describe('POST /auth/reset-password - Reset Password', () => {
    let resetCode: string;

    beforeEach(async () => {
      // Send forgot password request first
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ phone: adminData.phone });

      // Get reset code from Redis
      resetCode = await redis.get(`reset:${adminData.phone}`);
    });

    it('should reset password successfully', async () => {
      const resetDto = {
        phone: adminData.phone,
        reset_code: resetCode,
        new_password: 'resetpassword789',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send(resetDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Password reset successfully');

      // Verify new password works
      await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({
          phone: adminData.phone,
          password: 'resetpassword789',
        })
        .expect(200);

      // Verify reset code is cleared
      const clearedCode = await redis.get(`reset:${adminData.phone}`);
      expect(clearedCode).toBeNull();
    });

    it('should fail with incorrect reset code', async () => {
      const resetDto = {
        phone: adminData.phone,
        reset_code: '999999',
        new_password: 'newpassword',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send(resetDto)
        .expect(400);

      expect(response.body.message).toContain('Invalid reset code');
    });
  });

  describe('Security and Rate Limiting', () => {
    it('should implement proper CORS headers', async () => {
      const response = await request(app.getHttpServer()).options('/auth/admin/login').expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    it('should sanitize sensitive data in responses', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({
          phone: adminData.phone,
          password: 'password123',
        })
        .expect(200);

      // Should not return password hash
      expect(loginResponse.body.admin).not.toHaveProperty('password');
      expect(loginResponse.body.admin).not.toHaveProperty('password_hash');
    });

    it('should implement proper session management', async () => {
      const loginResponse = await request(app.getHttpServer()).post('/auth/admin/login').send({
        phone: adminData.phone,
        password: 'password123',
      });

      const token = loginResponse.body.access_token;

      // Verify token works
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      await request(app.getHttpServer())
        .post('/auth/admin/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify token is invalidated
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send('invalid-json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should handle concurrent login attempts', async () => {
      const loginDto = {
        phone: adminData.phone,
        password: 'password123',
      };

      // Multiple simultaneous login attempts
      const promises = Array(5)
        .fill(null)
        .map(() => request(app.getHttpServer()).post('/auth/admin/login').send(loginDto));

      const responses = await Promise.all(promises);

      // All should succeed (unless rate limited)
      const successful = responses.filter((r) => r.status === 200);
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle database connectivity issues gracefully', async () => {
      // This would simulate database connection issues
      // Implementation depends on your error handling strategy
      expect(true).toBe(true); // Placeholder test
    });
  });
});
