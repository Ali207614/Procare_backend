import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permission.guard';
import { PermissionsService } from '../../permissions/permissions.service';
import { PERMISSIONS_KEY, PERMISSIONS_MODE_KEY } from '../decorators/permission-decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflectorMock: jest.Mocked<Reflector>;
  let permissionsServiceMock: jest.Mocked<PermissionsService>;

  const mockUser = {
    id: 'user-id',
    phone_number: '+998901234567',
    roles: [{ name: 'admin', id: 'admin-role' }],
  };

  beforeEach(async () => {
    reflectorMock = {
      getAllAndOverride: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      getAllAndMerge: jest.fn(),
    } as any;

    permissionsServiceMock = {
      getPermissions: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: reflectorMock,
        },
        {
          provide: PermissionsService,
          useValue: permissionsServiceMock,
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user: any = mockUser): ExecutionContext => {
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
    it('should allow access when no permissions are required', async () => {
      // Arrange
      const context = createMockExecutionContext();
      reflectorMock.getAllAndOverride.mockReturnValue([]);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(permissionsServiceMock.getPermissions).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not found', async () => {
      // Arrange
      const context = createMockExecutionContext(null);
      reflectorMock.getAllAndOverride.mockReturnValue(['user.read']);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should allow access when user has required permissions in OR mode', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['user.read', 'user.write'];
      const userPermissions = ['user.read', 'admin.read'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions) // PERMISSIONS_KEY
        .mockReturnValueOnce('OR'); // PERMISSIONS_MODE_KEY

      permissionsServiceMock.getPermissions.mockResolvedValue(userPermissions);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(permissionsServiceMock.getPermissions).toHaveBeenCalledWith(mockUser.id);
    });

    it('should allow access when user has all required permissions in AND mode', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['user.read', 'user.write'];
      const userPermissions = ['user.read', 'user.write', 'admin.read'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions) // PERMISSIONS_KEY
        .mockReturnValueOnce('AND'); // PERMISSIONS_MODE_KEY

      permissionsServiceMock.getPermissions.mockResolvedValue(userPermissions);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks permissions in OR mode', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['admin.read', 'admin.write'];
      const userPermissions = ['user.read', 'user.write'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions) // PERMISSIONS_KEY
        .mockReturnValueOnce('OR'); // PERMISSIONS_MODE_KEY

      permissionsServiceMock.getPermissions.mockResolvedValue(userPermissions);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user lacks some permissions in AND mode', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['user.read', 'admin.write'];
      const userPermissions = ['user.read', 'user.write'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions) // PERMISSIONS_KEY
        .mockReturnValueOnce('AND'); // PERMISSIONS_MODE_KEY

      permissionsServiceMock.getPermissions.mockResolvedValue(userPermissions);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should default to OR mode when mode is not specified', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['user.read'];
      const userPermissions = ['user.read'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions) // PERMISSIONS_KEY
        .mockReturnValueOnce(null); // PERMISSIONS_MODE_KEY (default to OR)

      permissionsServiceMock.getPermissions.mockResolvedValue(userPermissions);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user has no permissions', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['user.read'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions) // PERMISSIONS_KEY
        .mockReturnValueOnce('OR'); // PERMISSIONS_MODE_KEY

      permissionsServiceMock.getPermissions.mockResolvedValue([]);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should handle empty required permissions array', async () => {
      // Arrange
      const context = createMockExecutionContext();
      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(null) // PERMISSIONS_KEY returns null
        .mockReturnValueOnce('OR'); // PERMISSIONS_MODE_KEY

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(permissionsServiceMock.getPermissions).not.toHaveBeenCalled();
    });

    it('should handle permission service errors', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['user.read'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions) // PERMISSIONS_KEY
        .mockReturnValueOnce('OR'); // PERMISSIONS_MODE_KEY

      permissionsServiceMock.getPermissions.mockRejectedValue(
        new Error('Permission service error'),
      );

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Permission service error');
    });
  });

  describe('permission modes', () => {
    it('should correctly evaluate AND mode with multiple permissions', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['perm1', 'perm2', 'perm3'];
      const userPermissions = ['perm1', 'perm2', 'perm3', 'perm4'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions)
        .mockReturnValueOnce('AND');

      permissionsServiceMock.getPermissions.mockResolvedValue(userPermissions);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should correctly evaluate OR mode with single matching permission', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['perm1', 'perm2', 'perm3'];
      const userPermissions = ['perm2', 'other.perm'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions)
        .mockReturnValueOnce('OR');

      permissionsServiceMock.getPermissions.mockResolvedValue(userPermissions);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('error messages and locations', () => {
    it('should provide specific error location for user not found', async () => {
      // Arrange
      const context = createMockExecutionContext(null);
      reflectorMock.getAllAndOverride.mockReturnValue(['user.read']);

      // Act & Assert
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.getResponse()).toEqual({
          message: 'The specified user does not exist or is no longer active.',
          location: 'not_found',
        });
      }
    });

    it('should provide specific error location for permission denied', async () => {
      // Arrange
      const context = createMockExecutionContext();
      const requiredPermissions = ['admin.delete'];
      const userPermissions = ['user.read'];

      reflectorMock.getAllAndOverride
        .mockReturnValueOnce(requiredPermissions)
        .mockReturnValueOnce('OR');

      permissionsServiceMock.getPermissions.mockResolvedValue(userPermissions);

      // Act & Assert
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.getResponse()).toEqual({
          message: 'You do not have the required permissions to perform this action.',
          location: 'permission_denied',
        });
      }
    });
  });

  describe('guard initialization', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should have Reflector and PermissionsService injected', () => {
      expect(guard['reflector']).toBeDefined();
      expect(guard['permissionsService']).toBeDefined();
    });
  });

  describe('reflector usage', () => {
    it('should call reflector with correct keys and context', async () => {
      // Arrange
      const context = createMockExecutionContext();
      reflectorMock.getAllAndOverride.mockReturnValue([]);

      // Act
      await guard.canActivate(context);

      // Assert
      expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});
