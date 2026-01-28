import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth.service';
import { JwtService } from '@nestjs/jwt';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { AdminsService } from '../../src/admins/admins.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { RegisterDto } from '../../src/dto/register.dto';
import { LoginDto } from '../../src/dto/login.dto';
import { VerifyDto } from '../../src/dto/verify.dto';
import { SmsDto } from '../../src/dto/sms.dto';
import { ForgotPasswordDto } from '../../src/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../src/dto/reset-password.dto';
import { Admin } from '../../src/common/types/admin.interface';
import bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;
  let jwtServiceMock: jest.Mocked<JwtService>;
  let adminsServiceMock: jest.Mocked<AdminsService>;

  const mockAdmin: Admin = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phone_number: '+998901234567',
    password: 'hashedPassword',
    full_name: 'Test Admin',
    branch_id: '660e8400-e29b-41d4-a716-446655440001',
    status: 'Pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockActiveAdmin: Admin = {
    ...mockAdmin,
    status: 'Active',
  };

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      del: jest.fn(),
      returning: jest.fn(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      count: jest.fn(),
      raw: jest.fn(),
      clone: jest.fn().mockReturnThis(),
    };

    knexMock = {
      transaction: jest.fn(),
      raw: jest.fn(),
      ...mockQueryBuilder,
    } as any;

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushByPrefix: jest.fn(),
    } as any;

    jwtServiceMock = {
      sign: jest.fn(),
      verify: jest.fn(),
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as any;

    adminsServiceMock = {
      findByPhoneNumber: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      changePassword: jest.fn(),
      findAll: jest.fn(),
      softDelete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: AdminsService,
          useValue: adminsServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationCode', () => {
    const smsDto: SmsDto = {
      phone_number: '+998901234567',
    };

    it('should send verification code successfully for pending admin', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      redisMock.set.mockResolvedValue('OK');

      // Act
      const result = await service.sendVerificationCode(smsDto);

      // Assert
      expect(result.message).toContain('sent');
      expect(result.code).toBeDefined();
      expect(result.code).toMatch(/^\d{6}$/); // 6 digit code
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringContaining(smsDto.phone_number),
        expect.any(String),
        300 // 5 minutes
      );
    });

    it('should throw NotFoundException when admin not found', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.sendVerificationCode(smsDto))
        .rejects.toThrow(NotFoundException);
      await expect(service.sendVerificationCode(smsDto))
        .rejects.toThrow('Admin not found');
    });

    it('should throw ConflictException when admin is not pending', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockActiveAdmin);

      // Act & Assert
      await expect(service.sendVerificationCode(smsDto))
        .rejects.toThrow(ConflictException);
    });

    it('should handle redis errors gracefully', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      redisMock.set.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(service.sendVerificationCode(smsDto))
        .rejects.toThrow('Redis connection failed');
    });
  });

  describe('verifyCode', () => {
    const verifyDto: VerifyDto = {
      phone_number: '+998901234567',
      code: '123456',
    };

    it('should verify code successfully', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('123456');
      redisMock.del.mockResolvedValue(1);

      // Act
      const result = await service.verifyCode(verifyDto);

      // Assert
      expect(result.message).toContain('verified');
      expect(redisMock.del).toHaveBeenCalledWith(
        expect.stringContaining(verifyDto.phone_number)
      );
    });

    it('should throw BadRequestException for invalid code', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('654321'); // Different code

      // Act & Assert
      await expect(service.verifyCode(verifyDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.verifyCode(verifyDto))
        .rejects.toThrow('Invalid verification code');
    });

    it('should throw BadRequestException when code expired', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(null); // Code expired

      // Act & Assert
      await expect(service.verifyCode(verifyDto))
        .rejects.toThrow(BadRequestException);
      await expect(service.verifyCode(verifyDto))
        .rejects.toThrow('Invalid verification code');
    });
  });

  describe('completeRegistration', () => {
    const registerDto: RegisterDto = {
      phone_number: '+998901234567',
      password: 'newPassword123',
      code: '123456',
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
      jwtServiceMock.sign.mockReturnValue('jwt-token');
    });

    it('should complete registration successfully', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('123456');
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.update.mockResolvedValue(1);
      redisMock.del.mockResolvedValue(1);

      // Act
      const result = await service.completeRegistration(registerDto);

      // Assert
      expect(result.access_token).toBe('jwt-token');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 12);
      expect(knexMock.update).toHaveBeenCalledWith({
        password: 'hashedNewPassword',
        status: 'Active',
        updated_at: expect.any(String),
      });
      expect(redisMock.del).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid code during registration', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('654321'); // Wrong code

      // Act & Assert
      await expect(service.completeRegistration(registerDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when admin not found during registration', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('123456');
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.completeRegistration(registerDto))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when admin is already active', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('123456');
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockActiveAdmin);

      // Act & Assert
      await expect(service.completeRegistration(registerDto))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      phone_number: '+998901234567',
      password: 'password123',
    };

    beforeEach(() => {
      jwtServiceMock.sign.mockReturnValue('jwt-token');
    });

    it('should login successfully with correct credentials', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockActiveAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result.access_token).toBe('jwt-token');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockActiveAdmin.password);
      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        id: mockActiveAdmin.id,
        phone: mockActiveAdmin.phone_number,
        full_name: mockActiveAdmin.full_name,
      });
    });

    it('should throw UnauthorizedException for non-existent admin', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.login(loginDto))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for inactive admin', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin); // Pending status

      // Act & Assert
      await expect(service.login(loginDto))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockActiveAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto))
        .rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto: ForgotPasswordDto = {
      phone_number: '+998901234567',
    };

    it('should send reset code successfully', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockActiveAdmin);
      redisMock.set.mockResolvedValue('OK');

      // Act
      const result = await service.forgotPassword(forgotPasswordDto);

      // Assert
      expect(result.message).toContain('sent');
      expect(result.code).toBeDefined();
      expect(result.code).toMatch(/^\d{6}$/);
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringContaining('reset-code:'),
        expect.any(String),
        900 // 15 minutes
      );
    });

    it('should throw NotFoundException for non-existent admin', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.forgotPassword(forgotPasswordDto))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for inactive admin', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin); // Pending status

      // Act & Assert
      await expect(service.forgotPassword(forgotPasswordDto))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto: ResetPasswordDto = {
      phone_number: '+998901234567',
      code: '123456',
      new_password: 'newPassword123',
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');
    });

    it('should reset password successfully', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('123456');
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockActiveAdmin);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.update.mockResolvedValue(1);
      redisMock.del.mockResolvedValue(1);

      // Act
      const result = await service.resetPassword(resetPasswordDto);

      // Assert
      expect(result.message).toContain('reset');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 12);
      expect(knexMock.update).toHaveBeenCalledWith({
        password: 'hashedNewPassword',
        updated_at: expect.any(String),
      });
      expect(redisMock.del).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid reset code', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('654321'); // Wrong code

      // Act & Assert
      await expect(service.resetPassword(resetPasswordDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when admin not found during reset', async () => {
      // Arrange
      redisMock.get.mockResolvedValue('123456');
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.resetPassword(resetPasswordDto))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('code generation and validation', () => {
    it('should generate 6-digit verification codes', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      redisMock.set.mockResolvedValue('OK');

      // Act
      const result = await service.sendVerificationCode({ phone_number: '+998901234567' });

      // Assert
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.code).toHaveLength(6);
    });

    it('should store codes with appropriate TTL', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      redisMock.set.mockResolvedValue('OK');

      // Act
      await service.sendVerificationCode({ phone_number: '+998901234567' });

      // Assert
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        300 // 5 minutes for verification
      );
    });

    it('should store reset codes with longer TTL', async () => {
      // Arrange
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockActiveAdmin);
      redisMock.set.mockResolvedValue('OK');

      // Act
      await service.forgotPassword({ phone_number: '+998901234567' });

      // Assert
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringContaining('reset-code:'),
        expect.any(String),
        900 // 15 minutes for reset
      );
    });
  });

  describe('error handling', () => {
    it('should handle bcrypt errors during password operations', async () => {
      // Arrange
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));
      redisMock.get.mockResolvedValue('123456');
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);

      // Act & Assert
      await expect(service.completeRegistration({
        phone_number: '+998901234567',
        password: 'password123',
        code: '123456',
      })).rejects.toThrow('Bcrypt error');
    });

    it('should handle database errors during operations', async () => {
      // Arrange
      knexMock.update.mockRejectedValue(new Error('Database error'));
      redisMock.get.mockResolvedValue('123456');
      adminsServiceMock.findByPhoneNumber.mockResolvedValue(mockAdmin);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      // Act & Assert
      await expect(service.completeRegistration({
        phone_number: '+998901234567',
        password: 'password123',
        code: '123456',
      })).rejects.toThrow('Database error');
    });
  });
});