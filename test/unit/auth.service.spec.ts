import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Knex } from 'knex';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AdminsService } from '../admins/admins.service';
import { RedisService } from '../common/redis/redis.service';
import { AdminFactory } from '../../test/factories/admin.factory';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let knexMock: jest.Mocked<Knex>;
  let adminsServiceMock: jest.Mocked<AdminsService>;
  let jwtServiceMock: jest.Mocked<JwtService>;
  let redisServiceMock: jest.Mocked<RedisService>;

  const mockAdmin = AdminFactory.create({
    phone: '+998901234567',
    password: 'hashedPassword123',
    status: 'Active',
  });

  beforeEach(async () => {
    // Create comprehensive mocks
    knexMock = {
      transaction: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    } as any;

    adminsServiceMock = {
      findByPhoneNumber: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    jwtServiceMock = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as any;

    redisServiceMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: 'default_KnexModuleConnectionToken',
          useValue: knexMock,
        },
        {
          provide: AdminsService,
          useValue: adminsServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: RedisService,
          useValue: redisServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationCode', () => {
    const smsDto = { phone_number: '+998901234567' };

    it('should throw NotFoundException when admin not found', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.sendVerificationCode(smsDto)).rejects.toThrow(NotFoundException);

      expect(adminsServiceMock.findByPhoneNumber).toHaveBeenCalledWith(smsDto.phone_number);
    });

    it('should throw ConflictException when admin status is not Pending', async () => {
      // Arrange
      const activeAdmin = { ...mockAdmin, status: 'Active' };
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(activeAdmin);

      // Act & Assert
      await expect(service.sendVerificationCode(smsDto)).rejects.toThrow(ConflictException);
    });

    it('should send verification code successfully for pending admin', async () => {
      // Arrange
      const pendingAdmin = { ...mockAdmin, status: 'Pending' };
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(pendingAdmin);
      redisServiceMock.set.mockResolvedValue('OK');

      // Act
      const result = await service.sendVerificationCode(smsDto);

      // Assert
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('code');
      expect(result.code).toHaveLength(6);
      expect(redisServiceMock.set).toHaveBeenCalledWith(
        expect.stringContaining(smsDto.phone_number),
        result.code,
        'EX',
        300, // 5 minutes
      );
    });
  });

  describe('verifyAdmin', () => {
    const verifyDto = {
      phone_number: '+998901234567',
      verification_code: '123456',
      password: 'newPassword123',
    };

    it('should throw BadRequestException for invalid verification code', async () => {
      // Arrange
      redisServiceMock.get.mockResolvedValue(null);

      // Act & Assert
      await expect(service.verifyAdmin(verifyDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for wrong verification code', async () => {
      // Arrange
      redisServiceMock.get.mockResolvedValue('654321');

      // Act & Assert
      await expect(service.verifyAdmin(verifyDto)).rejects.toThrow(BadRequestException);
    });

    it('should verify admin successfully with correct code', async () => {
      // Arrange
      redisServiceMock.get.mockResolvedValue('123456');
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);

      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockAdmin, status: 'Active' }]),
      };
      knexMock.transaction.mockResolvedValue(trxMock);

      jwtServiceMock.sign.mockReturnValue('jwt-token');

      // Act
      const result = await service.verifyAdmin(verifyDto);

      // Assert
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('admin');
      expect(result.access_token).toBe('jwt-token');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(verifyDto.password, 10);
      expect(redisServiceMock.del).toHaveBeenCalledWith(
        expect.stringContaining(verifyDto.phone_number),
      );
    });
  });

  describe('loginAdmin', () => {
    const loginDto = {
      phone_number: '+998901234567',
      password: 'password123',
    };

    it('should throw UnauthorizedException for non-existent admin', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.loginAdmin(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for inactive admin', async () => {
      // Arrange
      const inactiveAdmin = { ...mockAdmin, status: 'Inactive' };
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(inactiveAdmin);

      // Act & Assert
      await expect(service.loginAdmin(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(service.loginAdmin(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should login successfully with correct credentials', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtServiceMock.sign.mockReturnValue('jwt-token');

      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([]),
      };
      knexMock.transaction.mockResolvedValue(trxMock);

      // Act
      const result = await service.loginAdmin(loginDto);

      // Assert
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('admin');
      expect(result.access_token).toBe('jwt-token');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockAdmin.password);
    });
  });

  describe('forgotPassword', () => {
    const forgotDto = { phone_number: '+998901234567' };

    it('should throw NotFoundException for non-existent admin', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.forgotPassword(forgotDto)).rejects.toThrow(NotFoundException);
    });

    it('should send reset code successfully', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      redisServiceMock.set.mockResolvedValue('OK');

      // Act
      const result = await service.forgotPassword(forgotDto);

      // Assert
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('reset_code');
      expect(result.reset_code).toHaveLength(6);
      expect(redisServiceMock.set).toHaveBeenCalledWith(
        expect.stringContaining('reset-code:'),
        result.reset_code,
        'EX',
        900, // 15 minutes
      );
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      phone_number: '+998901234567',
      reset_code: '123456',
      new_password: 'newPassword123',
    };

    it('should throw BadRequestException for invalid reset code', async () => {
      // Arrange
      redisServiceMock.get.mockResolvedValue(null);

      // Act & Assert
      await expect(service.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
    });

    it('should reset password successfully', async () => {
      // Arrange
      redisServiceMock.get.mockResolvedValue('123456');
      mockedBcrypt.hash.mockResolvedValue('hashedNewPassword' as never);

      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([]),
      };
      knexMock.transaction.mockResolvedValue(trxMock);

      // Act
      const result = await service.resetPassword(resetDto);

      // Assert
      expect(result).toHaveProperty('message');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(resetDto.new_password, 10);
      expect(redisServiceMock.del).toHaveBeenCalledWith(expect.stringContaining('reset-code:'));
    });
  });

  describe('service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(service['knex']).toBeDefined();
      expect(service['adminsService']).toBeDefined();
      expect(service['jwtService']).toBeDefined();
      expect(service['redisService']).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      const smsDto = { phone_number: '+998901234567' };
      adminsServiceMock.findByPhoneNumber.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(service.sendVerificationCode(smsDto)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const smsDto = { phone_number: '+998901234567' };
      const pendingAdmin = { ...mockAdmin, status: 'Pending' };
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(pendingAdmin);
      redisServiceMock.set.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(service.sendVerificationCode(smsDto)).rejects.toThrow('Redis connection failed');
    });
  });
});
