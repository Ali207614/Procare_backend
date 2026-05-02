import * as bcrypt from 'bcrypt';
import sanitizeHtml from 'sanitize-html';
import { AuthService } from '../../src/auth/auth.service';
import { Admin } from '../../src/common/types/admin.interface';

describe('AuthService password login compatibility', () => {
  const phoneNumber = '+998901234567';

  function createService(admin: Admin): {
    service: AuthService;
    adminsService: {
      findByPhoneNumber: jest.Mock;
      checkAdminAccessControl: jest.Mock;
      updateAdminByPhone: jest.Mock;
    };
    jwtService: { sign: jest.Mock };
  } {
    const adminsService = {
      findByPhoneNumber: jest.fn().mockResolvedValue(admin),
      checkAdminAccessControl: jest.fn(),
      updateAdminByPhone: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    };
    const redisService = {
      set: jest.fn().mockResolvedValue(undefined),
    };
    const historyService = {
      createEvent: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new AuthService(
        jest.fn() as never,
        adminsService as never,
        jwtService as never,
        redisService as never,
        historyService as never,
        {} as never,
      ),
      adminsService,
      jwtService,
    };
  }

  it('accepts and migrates passwords hashed from the old sanitized value', async () => {
    const rawPassword = 'p@ss<word>&123';
    const legacyPassword = sanitizeHtml(rawPassword);
    const legacyHash = await bcrypt.hash(legacyPassword, 10);
    const admin = {
      id: '00000000-0000-4000-8000-000000000000',
      phone_number: phoneNumber,
      password: legacyHash,
      status: 'Open',
      is_active: true,
      phone_verified: true,
      first_name: null,
      last_name: null,
    } as Admin;
    const { service, adminsService } = createService(admin);

    await expect(
      service.login({
        phone_number: phoneNumber,
        password: rawPassword,
      }),
    ).resolves.toEqual({ access_token: 'jwt-token' });

    expect(adminsService.updateAdminByPhone).toHaveBeenCalledWith(phoneNumber, {
      password: expect.stringMatching(/^\$2[aby]\$/),
    });

    const migratedHash = adminsService.updateAdminByPhone.mock.calls[0][1].password;
    await expect(bcrypt.compare(rawPassword, migratedHash)).resolves.toBe(true);
  });
});
