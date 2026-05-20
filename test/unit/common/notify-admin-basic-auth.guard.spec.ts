import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotifyAdminBasicAuthGuard } from 'src/common/guards/notify-admin-basic-auth.guard';

describe('NotifyAdminBasicAuthGuard', () => {
  let guard: NotifyAdminBasicAuthGuard;
  let configServiceMock: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'NOTIFY_ADMIN_BASIC_AUTH_USER') {
          return 'test_user';
        }
        if (key === 'NOTIFY_ADMIN_BASIC_AUTH_PASSWORD') {
          return 'test_password';
        }
        return null;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyAdminBasicAuthGuard,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    guard = module.get<NotifyAdminBasicAuthGuard>(NotifyAdminBasicAuthGuard);
  });

  const createMockExecutionContext = (authHeader?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authHeader ? { authorization: authHeader } : {},
        }),
      }),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access with valid Basic Auth credentials', async () => {
    const creds = Buffer.from('test_user:test_password').toString('base64');
    const context = createMockExecutionContext(`Basic ${creds}`);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when authorization header is missing', async () => {
    const context = createMockExecutionContext(undefined);

    try {
      await guard.canActivate(context);
      throw new Error('Should have thrown UnauthorizedException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getResponse()).toEqual({
        message: 'Unauthorized: Missing or invalid basic authorization credentials',
        location: 'basic_auth_header',
      });
    }
  });

  it('should throw UnauthorizedException when authorization header is not Basic', async () => {
    const context = createMockExecutionContext('Bearer token123');

    try {
      await guard.canActivate(context);
      throw new Error('Should have thrown UnauthorizedException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getResponse()).toEqual({
        message: 'Unauthorized: Missing or invalid basic authorization credentials',
        location: 'basic_auth_header',
      });
    }
  });

  it('should throw UnauthorizedException when credentials are malformed', async () => {
    const context = createMockExecutionContext('Basic invalid_base64_or_malformed');

    try {
      await guard.canActivate(context);
      throw new Error('Should have thrown UnauthorizedException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getResponse()).toEqual({
        message: 'Unauthorized: Invalid credentials format',
        location: 'basic_auth_format',
      });
    }
  });

  it('should throw UnauthorizedException when user does not match', async () => {
    const creds = Buffer.from('wrong_user:test_password').toString('base64');
    const context = createMockExecutionContext(`Basic ${creds}`);

    try {
      await guard.canActivate(context);
      throw new Error('Should have thrown UnauthorizedException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getResponse()).toEqual({
        message: 'Unauthorized: Invalid login or password',
        location: 'basic_auth_credentials',
      });
    }
  });

  it('should throw UnauthorizedException when password does not match', async () => {
    const creds = Buffer.from('test_user:wrong_password').toString('base64');
    const context = createMockExecutionContext(`Basic ${creds}`);

    try {
      await guard.canActivate(context);
      throw new Error('Should have thrown UnauthorizedException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.getResponse()).toEqual({
        message: 'Unauthorized: Invalid login or password',
        location: 'basic_auth_credentials',
      });
    }
  });
});
