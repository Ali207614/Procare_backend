import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OtpService, GenerateOtpResult } from '../../../../src/common/services/otp.service';
import { SmsService } from '../../../../src/common/services/sms.service';

describe('OtpService', () => {
  let service: OtpService;
  let smsService: jest.Mocked<SmsService>;
  let configService: jest.Mocked<ConfigService>;
  let knex: any;

  beforeEach(async () => {
    smsService = {
      sendOtpSms: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          OTP_CODE_LENGTH: 6,
          OTP_EXPIRY_MINUTES: 5,
          OTP_MAX_ATTEMPTS: 3,
          OTP_COOLDOWN_MINUTES: 1,
        };
        return config[key];
      }),
    } as any;

    knex = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: SmsService, useValue: smsService },
        { provide: ConfigService, useValue: configService },
        { provide: 'default_KnexModuleConnectionToken', useValue: knex },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  describe('resendOtp', () => {
    it('should deactivate existing otps and generate a new one', async () => {
      // Mock methods inside service
      const deactivateSpy = jest.spyOn(service as any, 'deactivateExistingOtps').mockResolvedValue(undefined);

      const expectedResult: GenerateOtpResult = {
        success: true,
        otpId: 'new-otp-id',
        expiresAt: new Date(),
        message: 'Sent',
      };
      const generateSpy = jest.spyOn(service as any, 'generateAndSendOtp').mockResolvedValue(expectedResult);

      const formatPhoneSpy = jest.spyOn(service as any, 'formatPhoneNumber').mockReturnValue('+998901234567');

      const result = await service.resendOtp('901234567', 'login', 'uz');

      expect(formatPhoneSpy).toHaveBeenCalledWith('901234567');
      expect(deactivateSpy).toHaveBeenCalledWith('+998901234567', 'login');
      expect(generateSpy).toHaveBeenCalledWith('+998901234567', 'login', 'uz');
      expect(result).toEqual(expectedResult);
    });

    it('should use default language if not provided', async () => {
      const deactivateSpy = jest.spyOn(service as any, 'deactivateExistingOtps').mockResolvedValue(undefined);

      const expectedResult: GenerateOtpResult = {
        success: true,
        otpId: 'new-otp-id',
        expiresAt: new Date(),
        message: 'Sent',
      };
      const generateSpy = jest.spyOn(service as any, 'generateAndSendOtp').mockResolvedValue(expectedResult);

      const formatPhoneSpy = jest.spyOn(service as any, 'formatPhoneNumber').mockReturnValue('+998901234567');

      const result = await service.resendOtp('901234567', 'login');

      expect(formatPhoneSpy).toHaveBeenCalledWith('901234567');
      expect(deactivateSpy).toHaveBeenCalledWith('+998901234567', 'login');
      expect(generateSpy).toHaveBeenCalledWith('+998901234567', 'login', 'uz');
      expect(result).toEqual(expectedResult);
    });
  });
});
