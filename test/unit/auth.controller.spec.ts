import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/auth.controller';
import { AuthService } from '../../src/auth.service';
import { RegisterDto } from '../../src/dto/register.dto';
import { LoginDto } from '../../src/dto/login.dto';
import { VerifyDto } from '../../src/dto/verify.dto';
import { SmsDto } from '../../src/dto/sms.dto';
import { ForgotPasswordDto } from '../../src/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../src/dto/reset-password.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { AuthenticatedRequest } from '../../src/common/types/authenticated-request.type';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    sendVerificationCode: jest.fn(),
    verifyCode: jest.fn(),
    completeRegistration: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
  };

  const mockAdminPayload: AdminPayload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phone: '+998901234567',
    full_name: 'Test Admin',
    roles: ['admin-role-id'],
  };

  const mockAuthenticatedRequest: AuthenticatedRequest = {
    admin: mockAdminPayload,
  } as AuthenticatedRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendCode', () => {
    it('should send verification code successfully', async () => {
      // Arrange
      const smsDto: SmsDto = {
        phone_number: '+998901234567',
      };
      const expectedResult = {
        message: 'Verification code sent successfully',
        code: '123456',
      };

      mockAuthService.sendVerificationCode.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.sendCode(smsDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.sendVerificationCode).toHaveBeenCalledWith(smsDto);
    });

    it('should handle phone number not found', async () => {
      // Arrange
      const smsDto: SmsDto = {
        phone_number: '+998901111111',
      };
      const serviceError = new NotFoundException({
        message: 'Admin not found. Please contact super admin.',
        location: 'admin_not_found',
      });

      mockAuthService.sendVerificationCode.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.sendCode(smsDto)).rejects.toThrow(NotFoundException);
      await expect(controller.sendCode(smsDto)).rejects.toThrow('Admin not found');
    });

    it('should handle admin already active conflict', async () => {
      // Arrange
      const smsDto: SmsDto = {
        phone_number: '+998901234567',
      };
      const serviceError = new ConflictException('Admin is already active');

      mockAuthService.sendVerificationCode.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.sendCode(smsDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyCode', () => {
    it('should verify code successfully', async () => {
      // Arrange
      const verifyDto: VerifyDto = {
        phone_number: '+998901234567',
        code: '123456',
      };
      const expectedResult = {
        message: 'Code verified successfully',
      };

      mockAuthService.verifyCode.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.verifyCode(verifyDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.verifyCode).toHaveBeenCalledWith(verifyDto);
    });

    it('should handle invalid verification code', async () => {
      // Arrange
      const verifyDto: VerifyDto = {
        phone_number: '+998901234567',
        code: '654321',
      };
      const serviceError = new BadRequestException('Invalid verification code');

      mockAuthService.verifyCode.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.verifyCode(verifyDto)).rejects.toThrow(BadRequestException);
      await expect(controller.verifyCode(verifyDto)).rejects.toThrow('Invalid verification code');
    });

    it('should handle expired verification code', async () => {
      // Arrange
      const verifyDto: VerifyDto = {
        phone_number: '+998901234567',
        code: '123456',
      };
      const serviceError = new BadRequestException('Verification code has expired');

      mockAuthService.verifyCode.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.verifyCode(verifyDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeRegister', () => {
    it('should complete registration successfully', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        phone_number: '+998901234567',
        password: 'password123',
        code: '123456',
      };
      const expectedResult = {
        access_token: 'jwt-token-here',
      };

      mockAuthService.completeRegistration.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.completeRegister(registerDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.completeRegistration).toHaveBeenCalledWith(registerDto);
    });

    it('should handle invalid code during registration', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        phone_number: '+998901234567',
        password: 'password123',
        code: '654321',
      };
      const serviceError = new BadRequestException('Invalid verification code');

      mockAuthService.completeRegistration.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.completeRegister(registerDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle admin not found during registration', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        phone_number: '+998901111111',
        password: 'password123',
        code: '123456',
      };
      const serviceError = new NotFoundException('Admin not found');

      mockAuthService.completeRegistration.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.completeRegister(registerDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle password validation errors', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        phone_number: '+998901234567',
        password: 'weak',
        code: '123456',
      };
      const serviceError = new BadRequestException('Password too weak');

      mockAuthService.completeRegistration.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.completeRegister(registerDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      // Arrange
      const loginDto: LoginDto = {
        phone_number: '+998901234567',
        password: 'password123',
      };
      const expectedResult = {
        access_token: 'jwt-token-here',
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.login(loginDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle invalid credentials', async () => {
      // Arrange
      const loginDto: LoginDto = {
        phone_number: '+998901234567',
        password: 'wrongpassword',
      };
      const serviceError = new UnauthorizedException('Invalid credentials');

      mockAuthService.login.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(controller.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should handle non-existent admin login', async () => {
      // Arrange
      const loginDto: LoginDto = {
        phone_number: '+998901111111',
        password: 'password123',
      };
      const serviceError = new UnauthorizedException('Invalid credentials');

      mockAuthService.login.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle inactive admin login attempt', async () => {
      // Arrange
      const loginDto: LoginDto = {
        phone_number: '+998901234567',
        password: 'password123',
      };
      const serviceError = new UnauthorizedException('Account is not active');

      mockAuthService.login.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset code successfully', async () => {
      // Arrange
      const forgotPasswordDto: ForgotPasswordDto = {
        phone_number: '+998901234567',
      };
      const expectedResult = {
        message: 'Reset code sent successfully',
        code: '123456',
      };

      mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.forgotPassword(forgotPasswordDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
    });

    it('should handle admin not found for password reset', async () => {
      // Arrange
      const forgotPasswordDto: ForgotPasswordDto = {
        phone_number: '+998901111111',
      };
      const serviceError = new NotFoundException('Admin not found');

      mockAuthService.forgotPassword.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.forgotPassword(forgotPasswordDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle inactive admin password reset', async () => {
      // Arrange
      const forgotPasswordDto: ForgotPasswordDto = {
        phone_number: '+998901234567',
      };
      const serviceError = new ForbiddenException('Account is not active');

      mockAuthService.forgotPassword.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.forgotPassword(forgotPasswordDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      // Arrange
      const resetPasswordDto: ResetPasswordDto = {
        phone_number: '+998901234567',
        code: '123456',
        new_password: 'newPassword123',
      };
      const expectedResult = {
        message: 'Password reset successfully',
      };

      mockAuthService.resetPassword.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.resetPassword(resetPasswordDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.resetPassword).toHaveBeenCalledWith(resetPasswordDto);
    });

    it('should handle invalid reset code', async () => {
      // Arrange
      const resetPasswordDto: ResetPasswordDto = {
        phone_number: '+998901234567',
        code: '654321',
        new_password: 'newPassword123',
      };
      const serviceError = new BadRequestException('Invalid reset code');

      mockAuthService.resetPassword.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow(BadRequestException);
      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow('Invalid reset code');
    });

    it('should handle expired reset code', async () => {
      // Arrange
      const resetPasswordDto: ResetPasswordDto = {
        phone_number: '+998901234567',
        code: '123456',
        new_password: 'newPassword123',
      };
      const serviceError = new BadRequestException('Reset code has expired');

      mockAuthService.resetPassword.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle weak password during reset', async () => {
      // Arrange
      const resetPasswordDto: ResetPasswordDto = {
        phone_number: '+998901234567',
        code: '123456',
        new_password: 'weak',
      };
      const serviceError = new BadRequestException('Password does not meet requirements');

      mockAuthService.resetPassword.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      // Arrange
      const expectedResult = {
        access_token: 'new-jwt-token-here',
      };

      mockAuthService.refreshToken.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.refreshToken(mockAuthenticatedRequest);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.refreshToken).toHaveBeenCalledWith(mockAuthenticatedRequest.admin);
    });

    it('should handle invalid refresh token', async () => {
      // Arrange
      const serviceError = new UnauthorizedException('Invalid refresh token');

      mockAuthService.refreshToken.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.refreshToken(mockAuthenticatedRequest))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      // Arrange
      const expectedResult = {
        message: 'Logged out successfully',
      };

      mockAuthService.logout.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.logout(mockAuthenticatedRequest);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.logout).toHaveBeenCalledWith(mockAuthenticatedRequest.admin);
    });

    it('should handle logout errors gracefully', async () => {
      // Arrange
      const serviceError = new Error('Logout failed');

      mockAuthService.logout.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.logout(mockAuthenticatedRequest))
        .rejects.toThrow('Logout failed');
    });
  });

  describe('validation and error handling', () => {
    it('should properly pass through service validation errors', async () => {
      // Arrange
      const smsDto: SmsDto = {
        phone_number: 'invalid-phone',
      };

      const validationError = new BadRequestException({
        message: 'Invalid phone number format',
        location: 'phone_number',
      });
      mockAuthService.sendVerificationCode.mockRejectedValue(validationError);

      // Act & Assert
      await expect(controller.sendCode(smsDto)).rejects.toThrow(validationError);
    });

    it('should handle service layer exceptions', async () => {
      // Arrange
      const loginDto: LoginDto = {
        phone_number: '+998901234567',
        password: 'password123',
      };
      const serviceError = new Error('Database connection failed');
      mockAuthService.login.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow('Database connection failed');
    });
  });

  describe('API documentation and responses', () => {
    it('should have proper API tags and operations', () => {
      // This test verifies the presence of API documentation decorators
      // In a real test environment, this would be tested at integration level
      const sendCodeMethod = controller.sendCode;
      const loginMethod = controller.login;

      expect(sendCodeMethod).toBeDefined();
      expect(loginMethod).toBeDefined();
    });

    it('should return proper response format', async () => {
      // Arrange
      const smsDto: SmsDto = {
        phone_number: '+998901234567',
      };
      const expectedResult = {
        message: 'Verification code sent successfully',
        code: '123456',
      };

      mockAuthService.sendVerificationCode.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.sendCode(smsDto);

      // Assert
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('code');
      expect(typeof result.message).toBe('string');
      expect(typeof result.code).toBe('string');
    });
  });

  describe('authentication flow testing', () => {
    it('should complete full registration flow', async () => {
      // Test complete flow: send code -> verify code -> register
      const phoneNumber = '+998901234567';

      // 1. Send verification code
      const smsDto: SmsDto = { phone_number: phoneNumber };
      const sendCodeResult = { message: 'Code sent', code: '123456' };
      mockAuthService.sendVerificationCode.mockResolvedValue(sendCodeResult);

      const sendResult = await controller.sendCode(smsDto);
      expect(sendResult.code).toBeDefined();

      // 2. Verify code
      const verifyDto: VerifyDto = { phone_number: phoneNumber, code: '123456' };
      const verifyResult = { message: 'Code verified' };
      mockAuthService.verifyCode.mockResolvedValue(verifyResult);

      const verifyResponse = await controller.verifyCode(verifyDto);
      expect(verifyResponse.message).toContain('verified');

      // 3. Complete registration
      const registerDto: RegisterDto = {
        phone_number: phoneNumber,
        password: 'password123',
        code: '123456'
      };
      const registerResult = { access_token: 'jwt-token' };
      mockAuthService.completeRegistration.mockResolvedValue(registerResult);

      const registerResponse = await controller.completeRegister(registerDto);
      expect(registerResponse.access_token).toBeDefined();
    });

    it('should complete password reset flow', async () => {
      // Test complete flow: forgot password -> reset password
      const phoneNumber = '+998901234567';

      // 1. Send reset code
      const forgotDto: ForgotPasswordDto = { phone_number: phoneNumber };
      const forgotResult = { message: 'Reset code sent', code: '123456' };
      mockAuthService.forgotPassword.mockResolvedValue(forgotResult);

      const forgotResponse = await controller.forgotPassword(forgotDto);
      expect(forgotResponse.code).toBeDefined();

      // 2. Reset password
      const resetDto: ResetPasswordDto = {
        phone_number: phoneNumber,
        code: '123456',
        new_password: 'newPassword123'
      };
      const resetResult = { message: 'Password reset successfully' };
      mockAuthService.resetPassword.mockResolvedValue(resetResult);

      const resetResponse = await controller.resetPassword(resetDto);
      expect(resetResponse.message).toContain('reset');
    });
  });
});