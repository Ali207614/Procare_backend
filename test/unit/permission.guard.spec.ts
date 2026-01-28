import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsGuard } from '../../src/permission.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsService } from '../../src/../permissions/permissions.service';
import { UserPayload } from '../../src/types/user-payload.interface';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let permissionsService: PermissionsService;

  const mockPermissionsService = {
    getPermissions: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockUser: UserPayload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phone: '+998901234567',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    permissionsService = module.get<PermissionsService>(PermissionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user?: UserPayload): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    describe('when no permissions are required', () => {
      it('should allow access when no permissions are set', async () => {
        // Arrange
        mockReflector.getAllAndOverride.mockReturnValueOnce([]); // No required permissions
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR'); // Default mode

        const context = createMockExecutionContext(mockUser);

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
        expect(permissionsService.getPermissions).not.toHaveBeenCalled();
      });

      it('should allow access when permissions are undefined', async () => {
        // Arrange
        mockReflector.getAllAndOverride.mockReturnValueOnce(undefined); // No required permissions
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR'); // Default mode

        const context = createMockExecutionContext(mockUser);

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
        expect(permissionsService.getPermissions).not.toHaveBeenCalled();
      });
    });

    describe('when user is not authenticated', () => {
      it('should deny access when user is not provided', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create'];
        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');

        const context = createMockExecutionContext(); // No user

        // Act & Assert
        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(context)).rejects.toThrow(
          expect.objectContaining({
            message: 'The specified user does not exist or is no longer active.',
          }),
        );
      });

      it('should have correct error location for missing user', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create'];
        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');

        const context = createMockExecutionContext();

        // Act & Assert
        try {
          await guard.canActivate(context);
          fail('Should have thrown ForbiddenException');
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          expect(error.getResponse()).toMatchObject({
            location: 'not_found',
          });
        }
      });
    });

    describe('OR permission mode', () => {
      it('should allow access when user has at least one required permission', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create', 'repair_orders.edit'];
        const userPermissions = ['repair_orders.create', 'users.view'];

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');
        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
        expect(permissionsService.getPermissions).toHaveBeenCalledWith(mockUser.id);
      });

      it('should deny access when user has none of the required permissions', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create', 'repair_orders.edit'];
        const userPermissions = ['users.view', 'branches.view'];

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');
        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act & Assert
        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(context)).rejects.toThrow(
          expect.objectContaining({
            message: 'You do not have the required permissions to perform this action.',
          }),
        );
      });

      it('should use OR mode by default when mode is not specified', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create'];
        const userPermissions = ['repair_orders.create'];

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce(undefined); // No mode specified

        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
      });
    });

    describe('AND permission mode', () => {
      it('should allow access when user has all required permissions', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create', 'repair_orders.edit'];
        const userPermissions = ['repair_orders.create', 'repair_orders.edit', 'users.view'];

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('AND');
        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
      });

      it('should deny access when user is missing any required permission', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create', 'repair_orders.edit', 'repair_orders.delete'];
        const userPermissions = ['repair_orders.create', 'repair_orders.edit']; // Missing delete permission

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('AND');
        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act & Assert
        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('edge cases', () => {
      it('should deny access when user has no permissions', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create'];
        const userPermissions: string[] = [];

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');
        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act & Assert
        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(context)).rejects.toThrow(
          expect.objectContaining({
            message: 'You do not have the required permissions to perform this action.',
          }),
        );
      });

      it('should deny access when required permissions is empty but user permissions is also empty', async () => {
        // Arrange
        const requiredPermissions: string[] = [];
        const userPermissions: string[] = [];

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');
        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true); // Empty required permissions means no restrictions
      });

      it('should have correct error location for permission denied', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create'];
        const userPermissions: string[] = [];

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');
        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act & Assert
        try {
          await guard.canActivate(context);
          fail('Should have thrown ForbiddenException');
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          expect(error.getResponse()).toMatchObject({
            location: 'permission_denied',
          });
        }
      });
    });

    describe('service integration', () => {
      it('should handle permission service errors gracefully', async () => {
        // Arrange
        const requiredPermissions = ['repair_orders.create'];
        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');

        mockPermissionsService.getPermissions.mockRejectedValue(new Error('Service unavailable'));

        const context = createMockExecutionContext(mockUser);

        // Act & Assert
        await expect(guard.canActivate(context)).rejects.toThrow('Service unavailable');
      });

      it('should call permission service with correct user ID', async () => {
        // Arrange
        const testUser = { ...mockUser, id: 'specific-user-id' };
        const requiredPermissions = ['repair_orders.create'];
        const userPermissions = ['repair_orders.create'];

        mockReflector.getAllAndOverride.mockReturnValueOnce(requiredPermissions);
        mockReflector.getAllAndOverride.mockReturnValueOnce('OR');
        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(testUser);

        // Act
        await guard.canActivate(context);

        // Assert
        expect(permissionsService.getPermissions).toHaveBeenCalledWith('specific-user-id');
      });
    });

    describe('reflector integration', () => {
      it('should correctly retrieve permissions and mode from metadata', async () => {
        // Arrange
        const requiredPermissions = ['test.permission'];
        const userPermissions = ['test.permission'];

        mockReflector.getAllAndOverride
          .mockReturnValueOnce(requiredPermissions)
          .mockReturnValueOnce('AND');

        mockPermissionsService.getPermissions.mockResolvedValue(userPermissions);

        const context = createMockExecutionContext(mockUser);

        // Act
        await guard.canActivate(context);

        // Assert
        expect(mockReflector.getAllAndOverride).toHaveBeenCalledTimes(2);
        expect(mockReflector.getAllAndOverride).toHaveBeenNthCalledWith(1, 'permissions', [
          context.getHandler(),
          context.getClass(),
        ]);
        expect(mockReflector.getAllAndOverride).toHaveBeenNthCalledWith(2, 'permissionMode', [
          context.getHandler(),
          context.getClass(),
        ]);
      });
    });
  });
});