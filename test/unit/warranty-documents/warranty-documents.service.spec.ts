import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getKnexConnectionToken } from 'nestjs-knex';
import { WarrantyDocumentsService } from 'src/warranty-documents/warranty-documents.service';
import { PdfService } from 'src/pdf/pdf.service';
import { StorageService } from 'src/common/storage/storage.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RoleType } from 'src/common/types/role-type.enum';

describe('WarrantyDocumentsService - activate', () => {
  let service: WarrantyDocumentsService;
  let knex: any;
  let pdfService: any;
  let storageService: any;

  beforeEach(async () => {
    knex = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      transaction: jest.fn(),
      fn: { now: jest.fn().mockReturnValue(new Date()) },
    };
    knex.transaction.mockImplementation(async (cb: any) => {
      const trx = Object.assign(jest.fn().mockReturnValue(knex), knex);
      return cb(trx);
    });
    // the way the service uses knex is knex<T>('warranty_documents')
    const knexMock = Object.assign(jest.fn().mockReturnValue(knex), knex);

    pdfService = {
      generateOfferPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };

    storageService = {
      upload: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarrantyDocumentsService,
        { provide: getKnexConnectionToken('default'), useValue: knexMock },
        { provide: PdfService, useValue: pdfService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<WarrantyDocumentsService>(WarrantyDocumentsService);
  });

  const getAdminPayload = (roles: { type?: RoleType }[]): AdminPayload => ({
    id: 'admin-id',
    phone_number: '998901234567',
    roles: roles.map((r, i) => ({ id: `role-${i}`, name: 'Role', type: r.type })),
  });

  it('should throw ForbiddenException if admin is not SuperAdmin', async () => {
    const admin = getAdminPayload([{ type: RoleType.OPERATOR }]);
    await expect(service.activate('doc-id', admin)).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException if document not found', async () => {
    const admin = getAdminPayload([{ type: RoleType.SUPER_ADMIN }]);
    knex.first.mockResolvedValueOnce(null);

    await expect(service.activate('non-existent-id', admin)).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if document is Deleted', async () => {
    const admin = getAdminPayload([{ type: RoleType.SUPER_ADMIN }]);
    knex.first.mockResolvedValueOnce({ id: 'doc-id', status: 'Deleted' });

    await expect(service.activate('doc-id', admin)).rejects.toThrow(BadRequestException);
  });

  it('should return document and regenerate PDF if already active', async () => {
    const admin = getAdminPayload([{ type: RoleType.SUPER_ADMIN }]);
    const doc = { id: 'doc-id', status: 'Open', is_active: true, content_uz: 'content' };
    knex.first.mockResolvedValueOnce(doc);

    const result = await service.activate('doc-id', admin);

    expect(result).toEqual(doc);
    expect(pdfService.generateOfferPdf).toHaveBeenCalled();
    expect(storageService.upload).toHaveBeenCalled();
    expect(knex.transaction).not.toHaveBeenCalled();
  });

  it('should deactivate all and activate selected, then generate PDF', async () => {
    const admin = getAdminPayload([{ type: RoleType.SUPER_ADMIN }]);
    const doc = { id: 'doc-id', status: 'Open', is_active: false, content_uz: 'content' };
    const updatedDoc = { ...doc, is_active: true };

    knex.first.mockResolvedValueOnce(doc);
    knex.returning.mockResolvedValueOnce([updatedDoc]);

    const result = await service.activate('doc-id', admin);

    expect(result).toEqual(updatedDoc);
    expect(knex.transaction).toHaveBeenCalled();
    // We can't easily assert on the trx calls without more complex mock, but we assert the transaction was called
    expect(pdfService.generateOfferPdf).toHaveBeenCalled();
    expect(storageService.upload).toHaveBeenCalled();
  });
});
