import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { PdfService } from 'src/pdf/pdf.service';
import { StorageService } from 'src/common/storage/storage.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { OffersService } from 'src/offers/offers.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import {
  CreateServiceFormDto,
  DevicePointDto,
  ServiceFormChecklistDto,
  ServiceFormFormDto,
} from '../dto/create-service-form.dto';
import { GetServiceFormResponseDto } from '../dto/service-form-response.dto';
import { PdfPayload } from 'src/pdf/interfaces/pdf-payload.interface';
import { randomBytes } from 'crypto';

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

@Injectable()
export class ServiceFormsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
    private readonly logger: LoggerService,
    private readonly offersService: OffersService,
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

  async createServiceForm(
    repairOrderId: string,
    dto: CreateServiceFormDto,
  ): Promise<{ warranty_id: string; message: string }> {
    // 1. Fetch all data in a single SQL query
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

    // Clean up any corresponding records in the database
    await this.knex('service_forms').where({ repair_order_id: repairOrderId }).del();

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

    // 6. Save record to DB
    const now = new Date().toISOString();
    await this.knex('service_forms').insert({
      warranty_id: warrantyId,
      repair_order_id: repairOrderId,
      file_path: filePath,
      pattern: JSON.stringify(dto.pattern),
      device_points: JSON.stringify(dto.device_points),
      form: JSON.stringify({ ...dto.form, total_amount: payload.form.total_amount }),
      checklist: JSON.stringify(dto.checklist),
      comments: dto.comments,
      created_at: now,
      updated_at: now,
    });

    return { warranty_id: warrantyId, message: 'Service form generated successfully' };
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
}
