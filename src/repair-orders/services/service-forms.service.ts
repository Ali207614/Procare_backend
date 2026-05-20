import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { PdfService } from 'src/pdf/pdf.service';
import { StorageService } from 'src/common/storage/storage.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { OffersService } from 'src/offers/offers.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { toWarrantyDocumentPdfHtml } from 'src/common/utils/warranty-document-html.util';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { WarrantyDocument } from 'src/common/types/warranty-document.interface';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import {
  CreateServiceFormDto,
  DevicePointDto,
  ServiceFormChecklistDto,
  ServiceFormFormDto,
} from '../dto/create-service-form.dto';
import { CreateWarrantyAgreementDto } from '../dto/create-warranty-agreement.dto';
import {
  CreateWarrantyAgreementResponseDto,
  CreateServiceFormResponseDto,
  GetServiceFormResponseDto,
} from '../dto/service-form-response.dto';
import { PdfPayload } from 'src/pdf/interfaces/pdf-payload.interface';
import { randomBytes } from 'crypto';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';

export type WarrantyAgreementGenerationState =
  | 'started'
  | 'data_loaded'
  | 'pdf_generated'
  | 'uploaded'
  | 'completed'
  | 'failed';

export interface WarrantyAgreementGenerationEvent {
  state: WarrantyAgreementGenerationState;
  message: string;
  result?: CreateWarrantyAgreementResponseDto;
}

type WarrantyAgreementProgressHandler = (event: WarrantyAgreementGenerationEvent) => void;

export type ServiceFormGenerationState =
  | 'started'
  | 'data_loaded'
  | 'storage_prepared'
  | 'pdf_generated'
  | 'uploaded'
  | 'completed'
  | 'failed';

export interface ServiceFormGenerationEvent {
  state: ServiceFormGenerationState;
  message: string;
  result?: CreateServiceFormResponseDto;
}

type ServiceFormProgressHandler = (event: ServiceFormGenerationEvent) => void;

interface ServiceFormRow {
  id: string;
  warranty_id: string;
  repair_order_id: string;
  file_path: string;
  pattern: number[] | null;
  device_points: Record<string, DevicePointDto[]> | null;
  form: ServiceFormFormDto | null;
  checklist: ServiceFormChecklistDto | null;
  comments: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface RepairOrderServiceFormData {
  id: string;
  number_id: number;
  imei: string | null;
  source_type: string | null;
  created_at: string;
  customer_name: string;
  phone_number: string;
  device_name: string;
  specialist_name: string;
  total_amount: string | number;
}

/** Shape returned by get-warranty-agreement-data.sql */
interface WarrantyAgreementData {
  id: string;
  number_id: number;
  imei: string | null;
  status: string;
  customer_name: string;
  phone_number: string;
  device_name: string;
  service_form_warranty_id: string | null;
  service_form_created_at: string | null;
  service_form_created_by: string | null;
  service_form_admin_name: string;
  history_admin_name: string;
  total_final_problems: number;
  not_done_final_problems: number;
  source_type: string | null;
  total_amount: string | number;
  specialist_name: string;
}

/** Repair part info for warranty period calculation */
interface WarrantyRepairPart {
  repair_part_id: string;
  part_name: string;
  warranty_period: number;
}

@Injectable()
export class ServiceFormsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
    private readonly logger: LoggerService,
    private readonly offersService: OffersService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
  ) {}

  /**
   * Generates a random alphanumeric warranty ID (e.g. "SF-A3B9K2")
   */
  private generateWarrantyId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(6);
    const suffix = Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join('');
    return `SF-${suffix}`;
  }

  private async getRepairOrderServiceFormData(
    repairOrderId: string,
  ): Promise<RepairOrderServiceFormData> {
    const sql = loadSQL('repair-orders/queries/get-service-form-data.sql');
    const result: { rows: RepairOrderServiceFormData[] } = await this.knex.raw(sql, {
      repairOrderId,
    });
    const data = result.rows[0];

    if (!data) {
      throw new NotFoundException({
        message: 'Repair order not found or has been deleted',
        location: 'repair_order_id',
      });
    }

    return data;
  }

  async createServiceForm(
    repairOrderId: string,
    dto: CreateServiceFormDto,
    admin: AdminPayload,
    onProgress?: ServiceFormProgressHandler,
  ): Promise<CreateServiceFormResponseDto> {
    this.emitServiceFormProgress(onProgress, {
      state: 'started',
      message: 'Service form generation started',
    });

    // 1. Fetch all data in a single SQL query
    const data = await this.getRepairOrderServiceFormData(repairOrderId);

    const existingForm = await this.knex<ServiceFormRow>('service_forms')
      .where({ repair_order_id: repairOrderId })
      .orderBy('created_at', 'desc')
      .first();

    this.emitServiceFormProgress(onProgress, {
      state: 'data_loaded',
      message: 'Repair order data loaded',
    });

    // Check MinIO directly to ensure we clean up old PDF files
    const prefix = `service-forms/${repairOrderId}/`;
    let existingFiles: string[] = [];

    try {
      existingFiles = await this.storageService.listFiles(prefix);
    } catch (error) {
      this.logger.error(
        'Failed to list existing service forms from MinIO',
        (error as Error)?.stack,
      );
    }

    for (const file of existingFiles) {
      try {
        await this.storageService.delete(file);
        this.logger.log(`Deleted existing service form file from MinIO: ${file}`);
      } catch (error) {
        this.logger.error(
          `Failed to delete existing service form from MinIO: ${file}`,
          (error as Error)?.stack,
        );
      }
    }

    this.emitServiceFormProgress(onProgress, {
      state: 'storage_prepared',
      message: 'Existing service form files cleaned up',
    });

    // 2. Generate unique warranty ID
    const warrantyId = this.generateWarrantyId();

    // 3. Build the full PdfPayload
    const payload: PdfPayload = {
      warranty_id: warrantyId,
      pattern: dto.pattern,
      device_points: dto.device_points,
      checklist: dto.checklist,
      comments: dto.comments ?? '',
      form: {
        date: dto.form.date,
        pin: dto.form.pin,
        customer_name: data.customer_name,
        phone_number: data.phone_number,
        device_name: data.device_name,
        imei: data.imei ?? '',
        specialist_name: data.specialist_name,
        promo_code: '',
        repair_id: warrantyId,
        source: data.source_type ?? '',
        total_amount: Number(data.total_amount || 0),
      },
      offer_content: '',
    };

    // 4. Fetch Active Offer and convert to safe HTML
    try {
      const activeOffer = await this.offersService.findActive();
      const rawContent = activeOffer.content_uz || '';

      // Detect if content is already HTML (contains HTML tags) or plain markdown
      const isHtml = /<\/?[a-z][\s\S]*>/i.test(rawContent);
      const htmlContent = isHtml ? rawContent : await marked.parse(rawContent);

      payload.offer_content = sanitizeHtml(htmlContent, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'span']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          '*': ['style', 'class'],
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to fetch active offer for repair order ${repairOrderId}: ${(error as Error).message}`,
      );
    }

    // 5. Generate PDF buffer
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.pdfService.generateProcareServiceForm(payload);
    } catch (error) {
      this.logger.error(
        'Failed to generate service form PDF',
        JSON.stringify({
          errorMessage: (error as Error)?.message,
          stack: (error as Error)?.stack,
        }),
      );
      throw new InternalServerErrorException(
        `Failed to generate service form PDF: ${(error as Error)?.message || 'Unknown Error'}`,
      );
    }

    this.emitServiceFormProgress(onProgress, {
      state: 'pdf_generated',
      message: 'Service form PDF generated',
    });

    // 5. Upload to MinIO
    const filePath = `service-forms/${repairOrderId}/${warrantyId}.pdf`;
    try {
      await this.storageService.upload(filePath, pdfBuffer, { 'Content-Type': 'application/pdf' });
    } catch (error) {
      this.logger.error(
        'Failed to upload service form to storage',
        JSON.stringify({
          errorMessage: (error as Error)?.message,
          stack: (error as Error)?.stack,
        }),
      );
      throw new InternalServerErrorException(
        `Failed to upload service form to storage: ${(error as Error)?.message || 'Unknown Error'}`,
      );
    }

    this.emitServiceFormProgress(onProgress, {
      state: 'uploaded',
      message: 'Service form uploaded to storage',
    });

    // 6. Save record to DB and write a routed history comment
    const now = new Date().toISOString();
    await this.knex.transaction(async (trx) => {
      await trx('service_forms').where({ repair_order_id: repairOrderId }).del();

      await trx('service_forms').insert({
        warranty_id: warrantyId,
        repair_order_id: repairOrderId,
        file_path: filePath,
        pattern: JSON.stringify(dto.pattern),
        device_points: JSON.stringify(dto.device_points),
        form: JSON.stringify({ ...dto.form, total_amount: payload.form.total_amount }),
        checklist: JSON.stringify(dto.checklist),
        comments: dto.comments,
        created_by: admin.id,
        created_at: now,
        updated_at: now,
      });

      await this.changeLogger.logAction(
        trx,
        repairOrderId,
        existingForm ? 'service_form_updated' : 'service_form_created',
        { warranty_id: warrantyId },
        admin.id,
      );
    });

    const result = { warranty_id: warrantyId, message: 'Service form generated successfully' };

    this.emitServiceFormProgress(onProgress, {
      state: 'completed',
      message: 'Service form generated successfully',
      result,
    });

    return result;
  }

  /**
   * Creates a warranty agreement PDF with full validation and repair-part-based
   * warranty periods. Uses a dedicated SQL query and the active warranty document.
   */
  async createWarrantyAgreement(
    repairOrderId: string,
    dto: CreateWarrantyAgreementDto,
    admin: AdminPayload,
    onProgress?: WarrantyAgreementProgressHandler,
  ): Promise<CreateWarrantyAgreementResponseDto> {
    this.emitWarrantyAgreementProgress(onProgress, {
      state: 'started',
      message: 'Warranty agreement generation started',
    });

    // 1. Load warranty agreement data
    const data = await this.getWarrantyAgreementData(repairOrderId);

    // 2. Validate all required fields
    this.validateWarrantyAgreementData(data);

    // 3. Parse and validate dates from DTO
    const repairDate = this.parseDateOnly(dto.repair_date, 'repair_date');
    const deliveryDate = this.parseDateOnly(dto.delivery_date, 'delivery_date');

    // 4. Load active warranty document
    const activeWarrantyDocument = await this.getActiveWarrantyDocument();

    // 5. Load installed repair parts
    const repairParts = await this.getInstalledRepairParts(repairOrderId);

    if (repairParts.length === 0) {
      throw new BadRequestException({
        message: 'At least one repair part is required to generate warranty PDF',
        location: 'repair_parts',
      });
    }

    // 6. Build warranty period text
    const warrantyPeriodText = this.buildWarrantyPeriodText(repairParts, deliveryDate);

    // 7. Determine warranty ID and representative name
    const warrantyId = this.getValidString(data.service_form_warranty_id) || this.generateWarrantyId();
    const representativeName =
      this.getValidString(data.service_form_admin_name) ||
      this.getValidString(data.history_admin_name);

    // 8. Build PDF payload
    const warrantyContent = toWarrantyDocumentPdfHtml(activeWarrantyDocument.content_uz);

    const payload: PdfPayload = {
      warranty_id: warrantyId,
      pattern: [],
      device_points: {},
      checklist: {
        display: [],
        body: [],
        'ports-1': [],
        ports: [],
        other: [],
      },
      comments: '',
      form: {
        date: dto.repair_date,
        pin: '',
        customer_name: data.customer_name,
        phone_number: data.phone_number,
        device_name: data.device_name,
        imei: data.imei ?? '',
        specialist_name: data.specialist_name,
        promo_code: '',
        repair_id: warrantyId,
        source: data.source_type ?? '',
        total_amount: Number(data.total_amount || 0),
        delivery_date: dto.delivery_date,
        warranty_period: warrantyPeriodText,
        representative_name: representativeName,
      },
      warranty_content: warrantyContent,
    };

    this.emitWarrantyAgreementProgress(onProgress, {
      state: 'data_loaded',
      message: 'Repair order data loaded',
    });

    // 9. Generate PDF
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.pdfService.generateWarrantyAgreement(payload);
    } catch (error) {
      this.logger.error(
        'Failed to generate warranty agreement PDF',
        JSON.stringify({
          errorMessage: (error as Error)?.message,
          stack: (error as Error)?.stack,
        }),
      );
      throw new InternalServerErrorException(
        `Failed to generate warranty agreement PDF: ${(error as Error)?.message || 'Unknown Error'}`,
      );
    }

    this.emitWarrantyAgreementProgress(onProgress, {
      state: 'pdf_generated',
      message: 'Warranty agreement PDF generated',
    });

    // 10. Upload to storage and clean up old files
    const prefix = `warranty-agreements/${repairOrderId}/`;
    const filePath = `${prefix}${warrantyId}.pdf`;
    let existingFiles: string[] = [];

    try {
      existingFiles = await this.storageService.listFiles(prefix);
    } catch (error) {
      this.logger.error(
        'Failed to list existing warranty agreements from MinIO',
        (error as Error)?.stack,
      );
    }

    try {
      await this.storageService.upload(filePath, pdfBuffer, { 'Content-Type': 'application/pdf' });
    } catch (error) {
      this.logger.error(
        'Failed to upload warranty agreement to storage',
        JSON.stringify({
          errorMessage: (error as Error)?.message,
          stack: (error as Error)?.stack,
        }),
      );
      throw new InternalServerErrorException(
        `Failed to upload warranty agreement to storage: ${(error as Error)?.message || 'Unknown Error'}`,
      );
    }

    for (const file of existingFiles.filter((file) => file !== filePath)) {
      try {
        await this.storageService.delete(file);
        this.logger.log(`Deleted existing warranty agreement file from MinIO: ${file}`);
      } catch (error) {
        this.logger.error(
          `Failed to delete existing warranty agreement from MinIO: ${file}`,
          (error as Error)?.stack,
        );
      }
    }

    this.emitWarrantyAgreementProgress(onProgress, {
      state: 'uploaded',
      message: 'Warranty agreement uploaded to storage',
    });

    // 11. Log change history
    await this.knex.transaction(async (trx) => {
      await this.changeLogger.logAction(
        trx,
        repairOrderId,
        'warranty_agreement_generated',
        {
          warranty_id: warrantyId,
          warranty_document_id: activeWarrantyDocument.id,
          warranty_document_version: activeWarrantyDocument.version,
          repair_date: dto.repair_date,
          delivery_date: dto.delivery_date,
        },
        admin.id,
      );
    });

    // 12. Generate presigned URL and return
    const url = await this.storageService.generateUrl(filePath, 3600);
    const result: CreateWarrantyAgreementResponseDto = {
      warranty_id: warrantyId,
      url,
      message: 'Warranty agreement generated successfully',
    };

    this.emitWarrantyAgreementProgress(onProgress, {
      state: 'completed',
      message: 'Warranty agreement generated successfully',
      result,
    });

    return result;
  }

  async getServiceForm(repairOrderId: string): Promise<GetServiceFormResponseDto | object> {
    const record: ServiceFormRow | undefined = await this.knex<ServiceFormRow>('service_forms')
      .where({ repair_order_id: repairOrderId })
      .orderBy('created_at', 'desc')
      .first();

    if (!record) {
      return {};
    }

    // Generate a presigned MinIO URL (1 hour expiry)
    const url = await this.storageService.generateUrl(record.file_path, 3600);

    return {
      warranty_id: record.warranty_id,
      url,
      pattern: record.pattern ?? [],
      device_points: record.device_points ?? {},
      form: record.form ?? ({} as ServiceFormFormDto),
      checklist: record.checklist ?? ({} as ServiceFormChecklistDto),
      comments: record.comments,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  /**
   * Loads all data needed for warranty agreement generation from a single SQL query.
   */
  private async getWarrantyAgreementData(repairOrderId: string): Promise<WarrantyAgreementData> {
    const sql = loadSQL('repair-orders/queries/get-warranty-agreement-data.sql');
    const result: { rows: WarrantyAgreementData[] } = await this.knex.raw(sql, {
      repairOrderId,
    });
    const data = result.rows[0];

    if (!data) {
      throw new NotFoundException({
        message: 'Repair order not found or has been deleted',
        location: 'repair_order_id',
      });
    }

    return data;
  }

  /**
   * Validates all required fields for warranty generation are present.
   */
  private validateWarrantyAgreementData(data: WarrantyAgreementData): void {
    if (!this.getValidString(data.customer_name)) {
      throw new BadRequestException({
        message: 'Customer full name is required to generate warranty PDF',
        location: 'customer_name',
      });
    }

    if (!this.getValidString(data.phone_number)) {
      throw new BadRequestException({
        message: 'Customer phone number is required to generate warranty PDF',
        location: 'phone_number',
      });
    }

    if (!this.getValidString(data.device_name)) {
      throw new BadRequestException({
        message: 'Phone category is required to generate warranty PDF',
        location: 'phone_category',
      });
    }

    if (!this.getValidString(data.imei)) {
      throw new BadRequestException({
        message: 'IMEI is required to generate warranty PDF',
        location: 'imei',
      });
    }

    if (!data.service_form_warranty_id) {
      throw new BadRequestException({
        message: 'Service form must be generated before warranty PDF',
        location: 'service_form',
      });
    }

    if (data.total_final_problems > 0 && data.not_done_final_problems > 0) {
      throw new BadRequestException({
        message: 'All final problems must be marked as Done before warranty PDF generation',
        location: 'final_problems',
      });
    }
  }

  /**
   * Fetches the single active warranty document.
   */
  private async getActiveWarrantyDocument(): Promise<WarrantyDocument> {
    const doc = await this.knex<WarrantyDocument>('warranty_documents')
      .where({ is_active: true, status: 'Open' })
      .orderBy('created_at', 'desc')
      .first();

    if (!doc) {
      throw new NotFoundException({
        message: 'No active warranty document found',
        location: 'warranty_document',
      });
    }

    return doc;
  }

  /**
   * Fetches installed repair parts for this repair order.
   * Groups by repair_part_id to avoid duplicates, preferring parts
   * from final problems. Uses max warranty_period per unique part.
   */
  private async getInstalledRepairParts(repairOrderId: string): Promise<WarrantyRepairPart[]> {
    const rows = await this.knex('repair_order_parts as rop')
      .join('repair_parts as rp', 'rop.repair_part_id', 'rp.id')
      .where('rop.repair_order_id', repairOrderId)
      .whereNotNull('rop.repair_order_final_problem_id')
      .groupBy('rp.id', 'rp.part_name_uz', 'rp.part_name_ru', 'rp.part_name_en')
      .select(
        'rp.id as repair_part_id',
        this.knex.raw(
          `COALESCE(NULLIF(rp.part_name_uz, ''), NULLIF(rp.part_name_ru, ''), NULLIF(rp.part_name_en, '')) as part_name`,
        ),
        this.knex.raw('MAX(COALESCE(rp.warranty_period, 0)) as warranty_period'),
      ) as unknown as WarrantyRepairPart[];

    return rows;
  }

  /**
   * Builds the multiline warranty period text for the PDF.
   * Format per line: "PartName: DD.MM.YYYY"
   * Expiration = deliveryDate + warranty_period months
   */
  private buildWarrantyPeriodText(parts: WarrantyRepairPart[], deliveryDate: Date): string {
    return parts
      .map((part) => {
        const expirationDate = this.addMonths(deliveryDate, part.warranty_period);
        return `${part.part_name}: ${this.formatDateUz(expirationDate)}`;
      })
      .join('\n');
  }

  /**
   * Parses a YYYY-MM-DD string into a local Date, avoiding timezone shifts.
   */
  private parseDateOnly(value: string, location: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new BadRequestException({
        message: `Invalid date format: ${value}. Expected YYYY-MM-DD`,
        location,
      });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    // Validate parsed date matches input (catches Feb 30, etc.)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new BadRequestException({
        message: `Invalid date: ${value}`,
        location,
      });
    }

    return date;
  }

  /**
   * Adds months to a date. Uses native JS Date month arithmetic.
   * End-of-month edge cases use JS default behavior (e.g. Jan 31 + 1 month = Mar 3).
   */
  private addMonths(date: Date, months: number): Date {
    const result = new Date(date.getTime());
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /**
   * Formats a Date as DD.MM.YYYY for Uzbek display.
   */
  private formatDateUz(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  private getValidString(value: unknown): string {
    if (value === null || value === undefined) return '';

    const stringValue = String(value).trim();
    return stringValue.length > 0 ? stringValue : '';
  }

  private getValidDateString(value: unknown): string {
    const stringValue = this.getValidString(value);
    if (!stringValue) return '';

    const isoDate = stringValue.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDate) return isoDate[1];

    const date = new Date(stringValue);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  private emitWarrantyAgreementProgress(
    onProgress: WarrantyAgreementProgressHandler | undefined,
    event: WarrantyAgreementGenerationEvent,
  ): void {
    onProgress?.(event);
  }

  private emitServiceFormProgress(
    onProgress: ServiceFormProgressHandler | undefined,
    event: ServiceFormGenerationEvent,
  ): void {
    onProgress?.(event);
  }
}
