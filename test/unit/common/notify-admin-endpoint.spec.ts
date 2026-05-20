import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { NotifyAdminBasicAuthGuard } from 'src/common/guards/notify-admin-basic-auth.guard';

@Controller('repair-orders')
class MockRepairOrdersController {
  @Get('notify-admin')
  @UseGuards(NotifyAdminBasicAuthGuard)
  notifyAdmin() {
    return { success: true };
  }
}

describe('NotifyAdminBasicAuthGuard - Integration & Stress Tests', () => {
  let app: INestApplication;
  let configServiceMock: jest.Mocked<ConfigService>;

  beforeAll(async () => {
    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'NOTIFY_ADMIN_BASIC_AUTH_USER') {
          return 'secure_user';
        }
        if (key === 'NOTIFY_ADMIN_BASIC_AUTH_PASSWORD') {
          return 'secure_password_123';
        }
        return null;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MockRepairOrdersController],
      providers: [
        NotifyAdminBasicAuthGuard,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow access to notify-admin with valid credentials', async () => {
    const creds = Buffer.from('secure_user:secure_password_123').toString('base64');
    const response = await request(app.getHttpServer())
      .get('/repair-orders/notify-admin')
      .set('Authorization', `Basic ${creds}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('should reject access to notify-admin with invalid credentials', async () => {
    const creds = Buffer.from('wrong_user:wrong_password').toString('base64');
    const response = await request(app.getHttpServer())
      .get('/repair-orders/notify-admin')
      .set('Authorization', `Basic ${creds}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: 'Unauthorized: Invalid login or password',
      location: 'basic_auth_credentials',
    });
  });

  it('should reject access to notify-admin with missing authorization header', async () => {
    const response = await request(app.getHttpServer())
      .get('/repair-orders/notify-admin');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: 'Unauthorized: Missing or invalid basic authorization credentials',
      location: 'basic_auth_header',
    });
  });

  it('should reject access to notify-admin with malformed authorization header', async () => {
    const response = await request(app.getHttpServer())
      .get('/repair-orders/notify-admin')
      .set('Authorization', 'Basic malformed_base64');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: 'Unauthorized: Invalid credentials format',
      location: 'basic_auth_format',
    });
  });

  it('should handle stress-testing with 100 requests (batches of 10) without failure', async () => {
    const correctCredentials = Buffer.from('secure_user:secure_password_123').toString('base64');
    const incorrectCredentials = Buffer.from('wrong_user:wrong_password').toString('base64');

    const responses: any[] = [];
    const startTime = Date.now();

    for (let batch = 0; batch < 10; batch++) {
      const batchRequests = Array.from({ length: 10 }).map((_, index) => {
        const globalIndex = batch * 10 + index;
        const useCorrect = globalIndex % 2 === 0;
        const creds = useCorrect ? correctCredentials : incorrectCredentials;
        return request(app.getHttpServer())
          .get('/repair-orders/notify-admin')
          .set('Authorization', `Basic ${creds}`);
      });
      const batchResponses = await Promise.all(batchRequests);
      responses.push(...batchResponses);
    }

    const duration = Date.now() - startTime;
    console.log(`Successfully completed 100 requests in ${duration}ms`);

    responses.forEach((response, index) => {
      const wasCorrect = index % 2 === 0;
      if (wasCorrect) {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
      } else {
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Unauthorized: Invalid login or password');
      }
    });

    const avgTime = duration / 100;
    console.log(`Average request processing time: ${avgTime}ms`);
    expect(avgTime).toBeLessThan(50);
  });
});
