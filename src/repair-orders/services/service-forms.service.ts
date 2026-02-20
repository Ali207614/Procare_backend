import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { PdfService } from 'src/pdf/pdf.service';
import { StorageService } from 'src/common/storage/storage.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { CreateServiceFormDto } from '../dto/create-service-form.dto';
import { PdfPayload } from 'src/pdf/interfaces/pdf-payload.interface';
import { randomBytes } from 'crypto';

interface ServiceFormRow {
  id: string;
  warranty_id: string;
  repair_order_id: string;
  file_path: string;
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
}

@Injectable()
export class ServiceFormsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
    private readonly logger: LoggerService,
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

    if (!data.imei) {
      throw new BadRequestException({
        message:
          'IMEI is required for service form creation. Please update the repair order with an IMEI before generating the service form.',
        location: 'imei',
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
      },
    };

    // 4. Generate PDF buffer
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.pdfService.generateProcareServiceForm(payload);
    } catch (error) {
      this.logger.error('Failed to generate service form PDF', (error as Error)?.stack);
      throw new InternalServerErrorException('Failed to generate service form PDF');
    }

    // 5. Upload to MinIO
    const filePath = `service-forms/${repairOrderId}/${warrantyId}.pdf`;
    try {
      await this.storageService.upload(filePath, pdfBuffer, { 'Content-Type': 'application/pdf' });
    } catch (error) {
      this.logger.error('Failed to upload service form to storage', (error as Error)?.stack);
      throw new InternalServerErrorException('Failed to upload service form to storage');
    }

    // 6. Save record to DB
    const now = new Date().toISOString();
    await this.knex('service_forms').insert({
      warranty_id: warrantyId,
      repair_order_id: repairOrderId,
      file_path: filePath,
      created_at: now,
      updated_at: now,
    });

    return { warranty_id: warrantyId, message: 'Service form generated successfully' };
  }

  async getServiceForm(repairOrderId: string): Promise<{ warranty_id: string; url: string }> {
    const record: ServiceFormRow | undefined = await this.knex<ServiceFormRow>('service_forms')
      .where({ repair_order_id: repairOrderId })
      .orderBy('created_at', 'desc')
      .first();

    if (!record) {
      throw new NotFoundException({
        message: 'No service form found for this repair order',
        location: 'repair_order_id',
      });
    }

    // Generate a presigned MinIO URL (1 hour expiry)
    const url = await this.storageService.generateUrl(record.file_path, 3600);

    return { warranty_id: record.warranty_id, url };
  }
}
