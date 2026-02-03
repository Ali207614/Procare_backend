import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAdminAuthGuard } from './jwt-admin.guard';
import { RedisService } from '../redis/redis.service';
import { AdminFactory } from '../../../test/factories/admin.factory';

describe('JwtAdminAuthGuard', () => {
  let guard: JwtAdminAuthGuard;
  let redisServiceMock: jest.Mocked<RedisService>;

  const mockAdmin = AdminFactory.createPayload();
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

  beforeEach(async () => {
    redisServiceMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAdminAuthGuard,
        {
          provide: RedisService,
          useValue: redisServiceMock,
        },
      ],
    }).compile();

    guard = module.get<JwtAdminAuthGuard>(JwtAdminAuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    user: any = mockAdmin,
    authHeader: string = `Bearer ${mockToken}`,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers: {
            authorization: authHeader,
          },
          admin: undefined, // Will be set by guard
        }),
      }),
    } as any;
  };

  // Mock the parent AuthGuard's canActivate method
  beforeEach(() => {
    jest.spyOn(guard, 'canActivate' as any).mockImplementation(async (context) => {
      // Call the actual method implementation
      const originalMethod = Object.getPrototypeOf(guard).canActivate;
      return originalMethod.call(guard, context);
    });

    // Mock the super.canActivate call
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockResolvedValue(true);
  });

  describe('canActivate', () => {
    it('should allow access with valid token and session', async () => {
      // Arrange
      const context = createMockExecutionContext();
      redisServiceMock.get
        .mockResolvedValueOnce(mockToken) // session check
        .mockResolvedValueOnce(null); // blacklist check

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(redisServiceMock.get).toHaveBeenCalledWith(`session:admin:${mockAdmin.id}`);
      expect(redisServiceMock.get).toHaveBeenCalledWith(`blacklist:token:${mockToken}`);

      // Check that admin data is set on request
      const request = context.switchToHttp().getRequest();
      expect(request.admin).toEqual({
        id: mockAdmin.id,
        phone_number: mockAdmin.phone_number,
        roles: mockAdmin.roles,
      });
    });

    it('should deny access when super.canActivate returns false', async () => {
      // Arrange
      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValue(false);
      const context = createMockExecutionContext();

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(false);
    });

    it('should throw UnauthorizedException when user data is invalid', async () => {
      // Arrange
      const context = createMockExecutionContext({ id: null });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      // Arrange
      const context = createMockExecutionContext(undefined);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when authorization header is missing', async () => {
      // Arrange
      const context = createMockExecutionContext(mockAdmin, '');

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when authorization header does not start with Bearer', async () => {
      // Arrange
      const context = createMockExecutionContext(mockAdmin, 'Basic token');

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session token does not match', async () => {
      // Arrange
      const context = createMockExecutionContext();
      redisServiceMock.get.mockResolvedValueOnce('different-token'); // session check

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);

      expect(redisServiceMock.get).toHaveBeenCalledWith(`session:admin:${mockAdmin.id}`);
    });

    it('should allow access when no session exists in Redis', async () => {
      // Arrange
      const context = createMockExecutionContext();
      redisServiceMock.get
        .mockResolvedValueOnce(null) // session check - no session
        .mockResolvedValueOnce(null); // blacklist check

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when token is blacklisted', async () => {
      // Arrange
      const context = createMockExecutionContext();
      redisServiceMock.get
        .mockResolvedValueOnce(mockToken) // session check
        .mockResolvedValueOnce('blacklisted'); // blacklist check

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);

      expect(redisServiceMock.get).toHaveBeenCalledWith(`blacklist:token:${mockToken}`);
    });

    it('should handle Redis connection errors gracefully', async () => {
      // Arrange
      const context = createMockExecutionContext();
      redisServiceMock.get.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Redis connection failed');
    });

    it('should set admin data with empty roles if roles are undefined', async () => {
      // Arrange
      const userWithoutRoles = { ...mockAdmin, roles: undefined };
      const context = createMockExecutionContext(userWithoutRoles);
      redisServiceMock.get
        .mockResolvedValueOnce(mockToken) // session check
        .mockResolvedValueOnce(null); // blacklist check

      // Act
      await guard.canActivate(context);

      // Assert
      const request = context.switchToHttp().getRequest();
      expect(request.admin.roles).toEqual([]);
    });
  });

  describe('error messages and locations', () => {
    it('should provide specific error location for invalid user data', async () => {
      // Arrange
      const context = createMockExecutionContext({ id: null });

      // Act & Assert
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.getResponse()).toEqual({
          message: 'Invalid user data',
          location: 'invalid_user_data',
        });
      }
    });

    it('should provide specific error location for missing authorization header', async () => {
      // Arrange
      const context = createMockExecutionContext(mockAdmin, '');

      // Act & Assert
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.getResponse()).toEqual({
          message: 'Authorization header missing or invalid',
          location: 'missing_authorization-admin',
        });
      }
    });

    it('should provide specific error location for invalid session', async () => {
      // Arrange
      const context = createMockExecutionContext();
      redisServiceMock.get.mockResolvedValueOnce('different-token');

      // Act & Assert
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.getResponse()).toEqual({
          message: 'Session invalid or expired',
          location: 'invalid_session',
        });
      }
    });

    it('should provide specific error location for blacklisted token', async () => {
      // Arrange
      const context = createMockExecutionContext();
      redisServiceMock.get
        .mockResolvedValueOnce(mockToken) // session check
        .mockResolvedValueOnce('blacklisted'); // blacklist check

      // Act & Assert
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.getResponse()).toEqual({
          message: 'Token has been blacklisted',
          location: 'blacklisted_token',
        });
      }
    });
  });

  describe('guard initialization', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should have RedisService injected', () => {
      expect(guard['redisService']).toBeDefined();
    });
  });
});
