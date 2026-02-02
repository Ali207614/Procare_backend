import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminFactory } from '../../test/factories/admin.factory';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: jest.Mocked<AuthService>;

  const mockAdmin = AdminFactory.create();
  const mockAdminPayload = AdminFactory.createPayload();

  beforeEach(async () => {
    // Create comprehensive mock for AuthService
    authServiceMock = {
      sendVerificationCode: jest.fn(),
      verifyAdmin: jest.fn(),
      loginAdmin: jest.fn(),
      loginUser: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendCode', () => {
    const smsDto = { phone_number: '+998901234567' };

    it('should send verification code successfully', async () => {
      // Arrange
      const expectedResult = {
        message: 'Verification code sent successfully',
        code: '123456',
      };
      authServiceMock.sendVerificationCode.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.sendCode(smsDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(authServiceMock.sendVerificationCode).toHaveBeenCalledWith(smsDto);
    });

    it('should handle service errors', async () => {
      // Arrange
      authServiceMock.sendVerificationCode.mockRejectedValue(
        new BadRequestException('Invalid phone number'),
      );

      // Act & Assert
      await expect(controller.sendCode(smsDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyCode', () => {
    const verifyDto = {
      phone_number: '+998901234567',
      verification_code: '123456',
      password: 'password123',
    };

    it('should verify code and return admin with token', async () => {
      // Arrange
      const expectedResult = {
        access_token: 'jwt-token',
        admin: mockAdmin,
      };
      authServiceMock.verifyAdmin.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.verifyCode(verifyDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(authServiceMock.verifyAdmin).toHaveBeenCalledWith(verifyDto);
    });

    it('should handle verification errors', async () => {
      // Arrange
      authServiceMock.verifyAdmin.mockRejectedValue(
        new BadRequestException('Invalid verification code'),
      );

      // Act & Assert
      await expect(controller.verifyCode(verifyDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const loginDto = {
      phone_number: '+998901234567',
      password: 'password123',
    };

    it('should login admin successfully', async () => {
      // Arrange
      const expectedResult = {
        access_token: 'jwt-token',
        admin: mockAdmin,
      };
      authServiceMock.loginAdmin.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.login(loginDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(authServiceMock.loginAdmin).toHaveBeenCalledWith(loginDto);
    });

    it('should handle login errors', async () => {
      // Arrange
      authServiceMock.loginAdmin.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    const forgotDto = { phone_number: '+998901234567' };

    it('should send reset code successfully', async () => {
      // Arrange
      const expectedResult = {
        message: 'Reset code sent successfully',
        reset_code: '123456',
      };
      authServiceMock.forgotPassword.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.forgotPassword(forgotDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(authServiceMock.forgotPassword).toHaveBeenCalledWith(forgotDto);
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      phone_number: '+998901234567',
      reset_code: '123456',
      new_password: 'newPassword123',
    };

    it('should reset password successfully', async () => {
      // Arrange
      const expectedResult = {
        message: 'Password reset successfully',
      };
      authServiceMock.resetPassword.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.resetPassword(resetDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(authServiceMock.resetPassword).toHaveBeenCalledWith(resetDto);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      current_password: 'oldPassword123',
      new_password: 'newPassword123',
    };

    const mockRequest = {
      admin: mockAdminPayload,
    };

    it('should change password successfully', async () => {
      // Arrange
      const expectedResult = {
        message: 'Password changed successfully',
      };
      authServiceMock.changePassword.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.changePassword(changePasswordDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(authServiceMock.changePassword).toHaveBeenCalledWith(
        mockAdminPayload.id,
        changePasswordDto,
      );
    });

    it('should handle change password errors', async () => {
      // Arrange
      authServiceMock.changePassword.mockRejectedValue(
        new BadRequestException('Current password is incorrect'),
      );

      // Act & Assert
      await expect(controller.changePassword(changePasswordDto, mockAdminPayload)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('userLogin', () => {
    const userLoginDto = { phone_number: '+998901234568' };

    it('should login user successfully', async () => {
      // Arrange
      const expectedResult = {
        access_token: 'jwt-token',
        user: { id: 'user-id', phone: '+998901234568' },
      };
      authServiceMock.loginUser.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.userLogin(userLoginDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(authServiceMock.loginUser).toHaveBeenCalledWith(userLoginDto);
    });
  });

  describe('controller initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have authService injected', () => {
      expect(controller['authService']).toBeDefined();
    });
  });

  describe('input validation', () => {
    it('should accept valid phone numbers', async () => {
      // Arrange
      const validPhones = ['+998901234567', '+998991234567', '+998881234567'];
      authServiceMock.sendVerificationCode.mockResolvedValue({
        message: 'Code sent',
        code: '123456',
      });

      // Act & Assert
      for (const phone of validPhones) {
        await expect(controller.sendCode({ phone_number: phone })).resolves.toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('should propagate service exceptions', async () => {
      // Arrange
      const smsDto = { phone_number: '+998901234567' };
      const serviceError = new BadRequestException('Service error');
      authServiceMock.sendVerificationCode.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.sendCode(smsDto)).rejects.toThrow(serviceError);
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      const smsDto = { phone_number: '+998901234567' };
      authServiceMock.sendVerificationCode.mockRejectedValue(new Error('Unexpected error'));

      // Act & Assert
      await expect(controller.sendCode(smsDto)).rejects.toThrow('Unexpected error');
    });
  });
});
