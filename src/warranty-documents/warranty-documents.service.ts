import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { StorageService } from 'src/common/storage/storage.service';
import { toWarrantyDocumentPdfHtml } from 'src/common/utils/warranty-document-html.util';
import { WarrantyDocument } from 'src/common/types/warranty-document.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PdfService } from 'src/pdf/pdf.service';
import { CreateWarrantyDocumentDto } from './dto/create-warranty-document.dto';
import { FindAllWarrantyDocumentsDto } from './dto/find-all-warranty-documents.dto';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RoleType } from 'src/common/types/role-type.enum';

const WARRANTY_DOCUMENT_PDF_PATH = 'warranty-documents/current.pdf';
const WARRANTY_DOCUMENT_PDF_URL_EXPIRY_SECONDS = 3600;

@Injectable()
export class WarrantyDocumentsService {
  constructor(
    @InjectConnection() private readonly knex: Knex,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(dto: FindAllWarrantyDocumentsDto): Promise<PaginationResult<WarrantyDocument>> {
    const { limit = 10, offset = 0, status, is_active } = dto;

    const baseQuery = this.knex<WarrantyDocument>('warranty_documents')
      .orderBy('is_active', 'desc')
      .orderBy('created_at', 'desc');

    if (status) {
      void baseQuery.where('status', status);
    }

    if (is_active !== undefined) {
      void baseQuery.where('is_active', is_active);
    }

    const [{ count }] = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string | number }[]>('* as count');

    const rows = await baseQuery.limit(limit).offset(offset);

    return {
      total: Number(count),
      limit,
      offset,
      rows: rows as WarrantyDocument[],
    };
  }

  async findOne(id: string): Promise<WarrantyDocument> {
    const warrantyDocument = await this.knex<WarrantyDocument>('warranty_documents')
      .where({ id })
      .first();
    if (!warrantyDocument) {
      throw new NotFoundException(`Warranty document with ID ${id} not found`);
    }
    return warrantyDocument;
  }

  async findActive(): Promise<WarrantyDocument> {
    const warrantyDocument = await this.knex<WarrantyDocument>('warranty_documents')
      .where({ is_active: true, status: 'Open' })
      .orderBy('created_at', 'desc')
      .first();

    if (!warrantyDocument) {
      throw new NotFoundException('No active warranty document found');
    }

    return warrantyDocument;
  }

  async getPdfUrl(): Promise<{ url: string; expires_in: number }> {
    const activeWarrantyDocument = await this.findActive();
    const files = await this.storageService.listFiles(WARRANTY_DOCUMENT_PDF_PATH);

    if (!files.includes(WARRANTY_DOCUMENT_PDF_PATH)) {
      await this.generateAndUploadWarrantyDocumentPdf(activeWarrantyDocument.content_uz);
    }

    return {
      url: await this.storageService.generateUrl(
        WARRANTY_DOCUMENT_PDF_PATH,
        WARRANTY_DOCUMENT_PDF_URL_EXPIRY_SECONDS,
      ),
      expires_in: WARRANTY_DOCUMENT_PDF_URL_EXPIRY_SECONDS,
    };
  }

  async create(createWarrantyDocumentDto: CreateWarrantyDocumentDto): Promise<WarrantyDocument> {
    const latestWarrantyDocument = await this.knex<WarrantyDocument>('warranty_documents')
      .orderBy('created_at', 'desc')
      .first();

    const nextVersion = latestWarrantyDocument
      ? this.smartIncrement(latestWarrantyDocument, createWarrantyDocumentDto)
      : 'v1.0.0';
    const newWarrantyDocument = await this.knex.transaction(async (trx) => {
      await trx('warranty_documents').update({ is_active: false });

      const [createdWarrantyDocument]: WarrantyDocument[] = await trx<WarrantyDocument>(
        'warranty_documents',
      )
        .insert({
          ...createWarrantyDocumentDto,
          version: nextVersion,
          status: 'Open',
          is_active: true,
        })
        .returning('*');

      return createdWarrantyDocument;
    });

    await this.generateAndUploadWarrantyDocumentPdf(createWarrantyDocumentDto.content_uz);

    return newWarrantyDocument;
  }

  async activate(id: string, admin: AdminPayload): Promise<WarrantyDocument> {
    const isSuperAdmin = admin.roles.some((role) => role.type === RoleType.SUPER_ADMIN);
    if (!isSuperAdmin) {
      throw new ForbiddenException({
        message: 'Only Super Admins can activate warranty document versions.',
        location: 'super_admin_required',
      });
    }

    const targetDocument = await this.findOne(id);

    if (targetDocument.status === 'Deleted') {
      throw new BadRequestException({
        message: 'Deleted warranty documents cannot be activated.',
        location: 'warranty_document_deleted',
      });
    }

    if (targetDocument.is_active) {
      await this.generateAndUploadWarrantyDocumentPdf(targetDocument.content_uz);
      return targetDocument;
    }

    const activatedDocument = await this.knex.transaction(async (trx) => {
      await trx('warranty_documents').update({ is_active: false });

      const [updatedDoc]: WarrantyDocument[] = await trx<WarrantyDocument>('warranty_documents')
        .where({ id })
        .update({
          is_active: true,
          updated_at: this.knex.fn.now(),
        })
        .returning('*');

      return updatedDoc;
    });

    await this.generateAndUploadWarrantyDocumentPdf(activatedDocument.content_uz);

    return activatedDocument;
  }

  async remove(id: string): Promise<void> {
    const warrantyDocument = await this.findOne(id);
    await this.knex('warranty_documents')
      .where({ id: warrantyDocument.id })
      .update({ status: 'Deleted', is_active: false });
  }

  private smartIncrement(
    oldWarrantyDocument: WarrantyDocument,
    newWarrantyDocument: CreateWarrantyDocumentDto,
  ): string {
    const changePercentage = this.calculateChangePercentage(
      oldWarrantyDocument,
      newWarrantyDocument,
    );

    const parts = oldWarrantyDocument.version.replace('v', '').split('.');
    if (parts.length !== 3) return 'v1.0.0';

    let [major, minor, patch] = parts.map(Number);

    if (changePercentage > 70) {
      major++;
      minor = 0;
      patch = 0;
    } else if (changePercentage >= 20) {
      minor++;
      patch = 0;
    } else {
      patch++;
    }

    return `v${major}.${minor}.${patch}`;
  }

  private calculateChangePercentage(
    oldWarrantyDocument: WarrantyDocument,
    newWarrantyDocument: CreateWarrantyDocumentDto,
  ): number {
    const oldVal = oldWarrantyDocument.content_uz || '';
    const newVal = newWarrantyDocument.content_uz || '';

    if (!oldVal && !newVal) return 0;

    const distance = this.levenshteinDistance(String(oldVal), String(newVal));
    const maxLen = Math.max(String(oldVal).length, String(newVal).length, 1);

    return (distance / maxLen) * 100;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const n = s1.length;
    const m = s2.length;

    if (n > m) return this.levenshteinDistance(s2, s1);

    let prevRow = new Int32Array(n + 1);
    let currRow = new Int32Array(n + 1);

    for (let i = 0; i <= n; i++) prevRow[i] = i;

    for (let i = 1; i <= m; i++) {
      currRow[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
        currRow[j] = Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost);
      }
      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[n];
  }

  private async generateAndUploadWarrantyDocumentPdf(content: string): Promise<void> {
    const pdfBuffer = await this.pdfService.generateOfferPdf(
      toWarrantyDocumentPdfHtml(content),
    );
    await this.storageService.upload(WARRANTY_DOCUMENT_PDF_PATH, pdfBuffer, {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-cache',
    });
  }
}

