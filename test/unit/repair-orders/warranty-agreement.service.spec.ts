/* Mock ESM-only modules before any imports */
jest.mock('marked', () => ({
  marked: { parse: jest.fn().mockResolvedValue('<p>mocked</p>') },
}));
jest.mock('sanitize-html', () => jest.fn((html: string) => html));
jest.mock('src/common/utils/sql-loader.util', () => ({
  loadSQL: jest.fn().mockReturnValue('SELECT 1'),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceFormsService } from 'src/repair-orders/services/service-forms.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CreateWarrantyAgreementDto } from 'src/repair-orders/dto/create-warranty-agreement.dto';

/**
 * Helper to create a ServiceFormsService with all dependencies mocked.
 * We use `as never` to bypass strict typing on mocks.
 */
function createMockedService() {
  const warrantyDocQueryMock = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
  };

  const repairPartsQueryMock = {
    join: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue([]),
  };

  const mockKnexCallable = jest.fn().mockImplementation((table: string) => {
    if (table === 'warranty_documents') return warrantyDocQueryMock;
    if (table === 'repair_order_parts as rop') return repairPartsQueryMock;
    return {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      insert: jest.fn().mockResolvedValue([1]),
      returning: jest.fn().mockResolvedValue([]),
    };
  });

  const mockKnex = Object.assign(mockKnexCallable, {
    raw: jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn().mockImplementation(
      async (fn: (trx: unknown) => Promise<void>) => {
        const trxMock = jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([]),
          where: jest.fn().mockReturnThis(),
          del: jest.fn().mockResolvedValue(1),
        });
        await fn(trxMock);
      },
    ),
  });

  const mockPdfService = {
    generateWarrantyAgreement: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    generateProcareServiceForm: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  };

  const mockStorageService = {
    upload: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    listFiles: jest.fn().mockResolvedValue([]),
    generateUrl: jest.fn().mockResolvedValue('https://storage.procare.uz/test.pdf'),
  };

  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockOffersService = {
    findActive: jest.fn().mockRejectedValue(new NotFoundException('No active offer')),
  };

  const mockChangeLogger = {
    logAction: jest.fn().mockResolvedValue(undefined),
  };

  const service = new ServiceFormsService(
    mockKnex as never,
    mockPdfService as never,
    mockStorageService as never,
    mockLogger as never,
    mockOffersService as never,
    mockChangeLogger as never,
  );

  return {
    service,
    mockKnex,
    warrantyDocQueryMock,
    repairPartsQueryMock,
    mockPdfService,
    mockStorageService,
    mockLogger,
    mockChangeLogger,
  };
}

const validAdmin: AdminPayload = {
  id: 'admin-uuid-1',
  phone_number: '+998901234567',
  roles: [{ name: 'Super Admin', id: 'role-1', type: null }],
};

const validDto: CreateWarrantyAgreementDto = {
  repair_date: '2026-05-19',
  delivery_date: '2026-05-19',
};

function makeValidData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ro-uuid-1',
    number_id: 1001,
    imei: '353456789012345',
    status: 'Open',
    customer_name: 'Test Customer',
    phone_number: '+998901112233',
    device_name: 'iPhone 14 Pro',
    service_form_warranty_id: 'SF-ABC123',
    service_form_created_at: '2026-05-15',
    service_form_created_by: 'admin-uuid-2',
    service_form_admin_name: 'Service Admin',
    history_admin_name: 'History Admin',
    total_final_problems: 2,
    not_done_final_problems: 0,
    source_type: 'telegram',
    total_amount: 450000,
    specialist_name: 'John Doe',
    ...overrides,
  };
}

const activeWarrantyDoc = {
  id: 'wd-uuid-1',
  content_uz: 'Kafolat shartlari matn',
  content_ru: null,
  content_en: null,
  version: 'v1.0.0',
  is_active: true,
  status: 'Open' as const,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const installedParts = [
  { repair_part_id: 'part-1', part_name: 'Batareyka', warranty_period: 3 },
  { repair_part_id: 'part-2', part_name: 'Ekran', warranty_period: 6 },
];

/** Sets up mocks for a successful warranty generation scenario */
function setupSuccess(mocks: ReturnType<typeof createMockedService>, overrides?: Record<string, unknown>) {
  mocks.mockKnex.raw.mockResolvedValue({ rows: [makeValidData(overrides)] });
  mocks.warrantyDocQueryMock.first.mockResolvedValue(activeWarrantyDoc);
  mocks.repairPartsQueryMock.select.mockResolvedValue(installedParts);
}

describe('ServiceFormsService – createWarrantyAgreement', () => {
  // 1. Fails when repair order is missing/deleted
  it('throws NotFoundException when repair order not found', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({ rows: [] });

    await expect(
      mocks.service.createWarrantyAgreement('missing-uuid', validDto, validAdmin),
    ).rejects.toThrow(NotFoundException);
  });

  // 2. Fails when customer name is empty
  it('throws BadRequestException when customer_name is empty', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({ rows: [makeValidData({ customer_name: '' })] });

    try {
      await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);
      fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ location: 'customer_name' });
    }
  });

  // 3. Fails when phone number is empty
  it('throws BadRequestException when phone_number is empty', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({ rows: [makeValidData({ phone_number: '' })] });

    try {
      await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);
      fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ location: 'phone_number' });
    }
  });

  // 4. Fails when phone category name is empty
  it('throws BadRequestException when device_name is empty', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({ rows: [makeValidData({ device_name: '' })] });

    try {
      await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);
      fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ location: 'phone_category' });
    }
  });

  // 5. Fails when IMEI is empty
  it('throws BadRequestException when imei is empty', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({ rows: [makeValidData({ imei: '' })] });

    try {
      await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);
      fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ location: 'imei' });
    }
  });

  // 6. Fails when service form does not exist
  it('throws BadRequestException when no service form exists', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({
      rows: [makeValidData({ service_form_warranty_id: null })],
    });

    try {
      await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);
      fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ location: 'service_form' });
    }
  });

  // 7. Fails when at least one final problem has is_done = false
  it('throws BadRequestException when final problems are not all done', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({
      rows: [makeValidData({ total_final_problems: 3, not_done_final_problems: 1 })],
    });

    try {
      await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);
      fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ location: 'final_problems' });
    }
  });

  // 8. Fails when no active warranty document exists
  it('throws NotFoundException when no active warranty document found', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({ rows: [makeValidData()] });
    mocks.warrantyDocQueryMock.first.mockResolvedValue(null);
    mocks.repairPartsQueryMock.select.mockResolvedValue(installedParts);

    await expect(
      mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin),
    ).rejects.toThrow(NotFoundException);
  });

  // 9. Generates warranty period lines correctly
  it('calculates warranty expiration dates correctly', () => {
    const mocks = createMockedService();
    const svc = mocks.service as unknown as Record<string, (...args: never[]) => unknown>;

    const deliveryDate = svc['parseDateOnly']('2026-05-19' as never, 'delivery_date' as never) as Date;
    expect(deliveryDate.getFullYear()).toBe(2026);
    expect(deliveryDate.getMonth()).toBe(4); // May
    expect(deliveryDate.getDate()).toBe(19);

    // warranty_period = 3 months → Aug 19
    const exp = svc['addMonths'](deliveryDate as never, 3 as never) as Date;
    expect(svc['formatDateUz'](exp as never)).toBe('19.08.2026');

    // Full text
    const parts = [{ repair_part_id: 'p1', part_name: 'Batareyka', warranty_period: 3 }];
    const text = svc['buildWarrantyPeriodText'](parts as never, deliveryDate as never) as string;
    expect(text).toContain('Batareyka: 19.08.2026');
  });

  // 10. Uses active warranty_documents.content_uz in PDF payload
  it('includes warranty document content_uz in PDF payload', async () => {
    const mocks = createMockedService();
    setupSuccess(mocks);

    await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);

    const payload = mocks.mockPdfService.generateWarrantyAgreement.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload.warranty_content).toBeTruthy();
    expect(payload.warranty_content).toContain('Kafolat shartlari matn');
  });

  // 11. Uses service form creator admin full name as representative_name
  it('uses service_form_admin_name as representative_name', async () => {
    const mocks = createMockedService();
    setupSuccess(mocks, { service_form_admin_name: 'Admin Vakili' });

    await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);

    const payload = mocks.mockPdfService.generateWarrantyAgreement.mock.calls[0]?.[0];
    expect(payload.form.representative_name).toBe('Admin Vakili');
  });

  // 12. Uploads to warranty-agreements/{repairOrderId}/{warrantyId}.pdf
  it('uploads PDF to correct storage path', async () => {
    const mocks = createMockedService();
    setupSuccess(mocks);

    await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);

    expect(mocks.mockStorageService.upload).toHaveBeenCalled();
    const path = mocks.mockStorageService.upload.mock.calls[0]?.[0] as string;
    expect(path).toMatch(/^warranty-agreements\/ro-uuid-1\/SF-[A-Z0-9]+\.pdf$/);
  });

  // 13. Logs warranty_agreement_generated with enhanced metadata
  it('logs warranty_agreement_generated with metadata', async () => {
    const mocks = createMockedService();
    setupSuccess(mocks);

    await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);

    expect(mocks.mockChangeLogger.logAction).toHaveBeenCalledWith(
      expect.anything(),
      'ro-uuid-1',
      'warranty_agreement_generated',
      expect.objectContaining({
        warranty_document_id: 'wd-uuid-1',
        warranty_document_version: 'v1.0.0',
        repair_date: '2026-05-19',
        delivery_date: '2026-05-19',
      }),
      'admin-uuid-1',
    );
  });

  // 14. Fails when no repair parts exist
  it('throws BadRequestException when no repair parts found', async () => {
    const mocks = createMockedService();
    mocks.mockKnex.raw.mockResolvedValue({ rows: [makeValidData()] });
    mocks.warrantyDocQueryMock.first.mockResolvedValue(activeWarrantyDoc);
    mocks.repairPartsQueryMock.select.mockResolvedValue([]);

    try {
      await mocks.service.createWarrantyAgreement('ro-uuid-1', validDto, validAdmin);
      fail('Expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ location: 'repair_parts' });
    }
  });

  // 15. Zero warranty_period still includes part with delivery_date as expiration
  it('includes part with zero warranty_period using delivery_date as expiration', () => {
    const mocks = createMockedService();
    const svc = mocks.service as unknown as Record<string, (...args: never[]) => unknown>;

    const deliveryDate = svc['parseDateOnly']('2026-05-19' as never, 'delivery_date' as never) as Date;
    const parts = [{ repair_part_id: 'p1', part_name: 'Qopqoq', warranty_period: 0 }];
    const text = svc['buildWarrantyPeriodText'](parts as never, deliveryDate as never) as string;
    expect(text).toBe('Qopqoq: 19.05.2026');
  });
});
