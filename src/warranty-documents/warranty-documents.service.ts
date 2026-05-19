import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import sanitizeHtml from 'sanitize-html';
import { StorageService } from 'src/common/storage/storage.service';
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
      this.toWarrantyDocumentPdfHtml(content),
    );
    await this.storageService.upload(WARRANTY_DOCUMENT_PDF_PATH, pdfBuffer, {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-cache',
    });
  }

  private toWarrantyDocumentPdfHtml(content: string): string {
    const trimmed = content.trim();

    if (this.containsHtml(trimmed)) {
      return sanitizeHtml(trimmed, {
        allowedTags: [
          'p',
          'br',
          'strong',
          'b',
          'em',
          'i',
          'u',
          'ol',
          'ul',
          'li',
          'h1',
          'h2',
          'h3',
          'span',
        ],
        allowedAttributes: {},
      });
    }

    return this.plainTextToHtml(trimmed);
  }

  private containsHtml(value: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(value);
  }

  private plainTextToHtml(value: string): string {
    const blocks = value
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    return blocks
      .map((block) => {
        const lines = block
          .split(/\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))) {
          return `<ul>${lines.map((line) => `<li>${this.escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
        }

        const escaped = this.escapeHtml(lines.join(' '));
        const numberedSection = escaped.match(/^(\d+\.\s*[^:]+:)(\s*.*)$/);

        if (numberedSection) {
          return `<p><strong>${numberedSection[1]}</strong>${numberedSection[2]}</p>`;
        }

        if (/^[^.!?]+:$/.test(escaped)) {
          return `<p><strong>${escaped}</strong></p>`;
        }

        return `<p>${escaped}</p>`;
      })
      .join('');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
