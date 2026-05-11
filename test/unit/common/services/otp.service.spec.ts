import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { getKnexConnectionToken } from 'nestjs-knex';
import { OtpService } from 'src/common/services/otp.service';
import { SmsService } from 'src/common/services/sms.service';

describe('OtpService', () => {
  let service: OtpService;
  let knex: jest.Mocked<Knex>;
  let smsService: jest.Mocked<SmsService>;
  let configService: jest.Mocked<ConfigService>;

  const mockKnexQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    knex = Object.assign(jest.fn(() => mockKnexQueryBuilder), {
      transaction: jest.fn(),
    }) as any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: getKnexConnectionToken('default'),
          useValue: knex,
        },
        {
          provide: SmsService,
          useValue: smsService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasVerifiedOtp', () => {
    const phoneNumber = '+998901234567';
    const type = 'registration';

    it('should return true when a verified OTP exists within the time limit', async () => {
      // Arrange
      mockKnexQueryBuilder.first.mockResolvedValue({ id: 'some-otp-id', verified: true });
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      // Act
      const result = await service.hasVerifiedOtp(phoneNumber, type);

      // Assert
      expect(result).toBe(true);
      expect(knex).toHaveBeenCalledWith('otp_verifications');
      expect(mockKnexQueryBuilder.where).toHaveBeenCalledWith({
        phone_number: phoneNumber,
        type: type,
        verified: true,
      });
      expect(mockKnexQueryBuilder.andWhere).toHaveBeenCalledWith(
        'created_at',
        '>=',
        new Date(now - 10 * 60 * 1000)
      );

      jest.restoreAllMocks();
    });

    it('should return false when no verified OTP exists', async () => {
      // Arrange
      mockKnexQueryBuilder.first.mockResolvedValue(undefined);

      // Act
      const result = await service.hasVerifiedOtp(phoneNumber, type);

      // Assert
      expect(result).toBe(false);
    });

    it('should use the custom withinMinutes argument correctly', async () => {
       // Arrange
       mockKnexQueryBuilder.first.mockResolvedValue({ id: 'some-otp-id', verified: true });
       const customMinutes = 5;
       const now = Date.now();
       jest.spyOn(Date, 'now').mockReturnValue(now);

       // Act
       const result = await service.hasVerifiedOtp(phoneNumber, type, customMinutes);

       // Assert
       expect(result).toBe(true);
       expect(mockKnexQueryBuilder.andWhere).toHaveBeenCalledWith(
         'created_at',
         '>=',
         new Date(now - customMinutes * 60 * 1000)
       );

       jest.restoreAllMocks();
    });

    it('should format the phone number correctly before querying', async () => {
      // Arrange
      mockKnexQueryBuilder.first.mockResolvedValue({ id: 'some-otp-id', verified: true });
      const unformattedPhoneNumber = '901234567'; // Missing prefix

      // Act
      await service.hasVerifiedOtp(unformattedPhoneNumber, type);

      // Assert
      expect(mockKnexQueryBuilder.where).toHaveBeenCalledWith(
        expect.objectContaining({
          phone_number: '+998901234567', // Should be formatted
        })
      );
    });
  });
});
