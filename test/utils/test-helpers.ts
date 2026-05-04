import { INestApplication, ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { Knex } from 'knex';
import { SanitizationPipe } from '../../src/common/pipe/sanitization.pipe';
import { extractError } from '../../src/common/utils/validation.util';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { LoggerService } from '../../src/common/logger/logger.service';

export class TestHelpers {
  /**
   * Configure a test application with global pipes, filters, etc.
   */
  static configureTestApp(app: INestApplication): void {
    const logger = new LoggerService();
    const reflector = app.get(Reflector);

    app.useGlobalFilters(new HttpExceptionFilter(logger));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

    app.useGlobalPipes(
      new SanitizationPipe(),
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) => {
          const { message, location } = extractError(errors);
          return {
            response: { message, error: 'ValidationError', location },
            status: 400,
          };
        },
      }),
    );

    app.setGlobalPrefix('api/v1');
  }

  /**
   * Authenticate admin and return JWT token
   */
  static async authenticateAdmin(app: INestApplication): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        phone: '+998901234567',
        password: 'testpass',
      })
      .expect(200);

    return response.body.access_token;
  }

  /**
   * Authenticate user and return JWT token
   */
  static async authenticateUser(app: INestApplication): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/user/login')
      .send({
        phone: '+998901234568',
      })
      .expect(200);

    return response.body.access_token;
  }

  /**
   * Clean database tables
   */
  static async cleanDatabase(knex: Knex): Promise<void> {
    const tables = [
      'repair_orders',
      'repair_order_attachments',
      'repair_order_comments',
      'admins',
      'branches',
      'users',
      'roles',
      'permissions',
      'role_permissions',
    ];

    // Disable foreign key checks
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      try {
        await knex(table).del();
      } catch (error) {
        // Table might not exist
        const message = error instanceof Error ? error.message : String(error);
        console.warn('Could not clean table ' + table + ':', message);
      }
    }

    // Re-enable foreign key checks
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
  }

  /**
   * Seed test data
   */
  static async seedTestData(knex: Knex): Promise<void> {
    // Create test branch
    await knex('branches').insert({
      id: 'test-branch-id',
      name: 'Test Branch',
      address: 'Test Address',
      phone: '+998901234567',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Create test role
    await knex('roles').insert({
      id: 'test-role-id',
      name: 'Test Admin',
      description: 'Test admin role',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Create test admin
    await knex('admins').insert({
      id: 'test-admin-id',
      phone: '+998901234567',
      full_name: 'Test Admin',
      password: 'hashedpassword',
      branch_id: 'test-branch-id',
      role_id: 'test-role-id',
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
}
