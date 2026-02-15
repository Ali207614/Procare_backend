import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { StorageService } from 'src/common/storage/storage.service';
import sharp from 'sharp';

export interface RepairOrderAttachment {
  id: string;
  repair_order_id: string;
  original_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  description: string | null;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface AttachmentResponse extends RepairOrderAttachment {
  urls: Record<string, string>;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly changeLogger: RepairOrderChangeLoggerService,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly storageService: StorageService,
  ) {}

  async uploadAttachment(
    repairOrderId: string,
    file: Express.Multer.File,
    description: string,
    admin: AdminPayload,
  ): Promise<AttachmentResponse> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const order = (await this.knex('repair_orders').where({ id: repairOrderId }).first()) as
      | RepairOrder
      | undefined;

    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_update'],
      'repair_order_update',
      permissions,
    );

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG and PDF files allowed');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    const attachmentId = uuidv4();
    const fileExtension = file.originalname.split('.').pop() || '';
    const basePath = `repair-orders/${repairOrderId}/${attachmentId}`;
    const isImage = file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif';

    if (isImage) {
      // Process image variants with explicit format and quality
      const format = file.mimetype === 'image/png' ? 'png' : 'jpeg';

      const [small, medium, large] = await Promise.all([
        sharp(file.buffer)
          .resize(200, undefined, { withoutEnlargement: true })
          [format]({ quality: 70 })
          .toBuffer(),
        sharp(file.buffer)
          .resize(800, undefined, { withoutEnlargement: true })
          [format]({ quality: 80 })
          .toBuffer(),
        sharp(file.buffer)
          .resize(1200, undefined, { withoutEnlargement: true })
          [format]({ quality: 90 })
          .toBuffer(),
      ]);

      await Promise.all([
        this.storageService.upload(`${basePath}-small.${fileExtension}`, small, {
          'Content-Type': file.mimetype,
        }),
        this.storageService.upload(`${basePath}-medium.${fileExtension}`, medium, {
          'Content-Type': file.mimetype,
        }),
        this.storageService.upload(`${basePath}-large.${fileExtension}`, large, {
          'Content-Type': file.mimetype,
        }),
      ]);
    } else {
      // Upload single file
      await this.storageService.upload(`${basePath}.${fileExtension}`, file.buffer, {
        'Content-Type': file.mimetype,
      });
    }

    const attachment = (await this.knex('repair_order_attachments')
      .insert({
        id: attachmentId,
        repair_order_id: repairOrderId,
        original_name: file.originalname,
        file_name: `${attachmentId}.${fileExtension}`,
        file_path: basePath, // Store base path
        file_size: file.size,
        mime_type: file.mimetype,
        description: description || null,
        uploaded_by: admin.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')) as RepairOrderAttachment[];

    await this.changeLogger.logChange(
      repairOrderId,
      'attachment_uploaded',
      {
        file_name: file.originalname,
        description,
      },
      admin.id,
    );

    const result = attachment[0];
    return {
      ...result,
      urls: isImage
        ? await this.storageService.getMultipleUrls(basePath, fileExtension)
        : { original: await this.storageService.generateUrl(`${basePath}.${fileExtension}`) },
    };
  }

  async getAttachments(repairOrderId: string, admin: AdminPayload): Promise<AttachmentResponse[]> {
    const order = (await this.knex('repair_orders').where({ id: repairOrderId }).first()) as
      | RepairOrder
      | undefined;

    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_view'],
      'repair_order_view',
      permissions,
    );

    const attachments = (await this.knex('repair_order_attachments')
      .where({ repair_order_id: repairOrderId })
      .orderBy('created_at', 'desc')) as RepairOrderAttachment[];

    return Promise.all(
      attachments.map(async (attachment) => {
        const isImage =
          attachment.mime_type.startsWith('image/') && attachment.mime_type !== 'image/gif';
        const fileExtension = attachment.original_name.split('.').pop() || '';

        return {
          ...attachment,
          urls: isImage
            ? await this.storageService.getMultipleUrls(attachment.file_path, fileExtension)
            : {
                original: await this.storageService.generateUrl(
                  `${attachment.file_path}.${fileExtension}`,
                ),
              },
        };
      }),
    );
  }

  async deleteAttachment(
    repairOrderId: string,
    attachmentId: string,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order = (await this.knex('repair_orders').where({ id: repairOrderId }).first()) as
      | RepairOrder
      | undefined;

    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_delete'],
      'repair_order_delete',
      permissions,
    );

    const attachment = (await this.knex('repair_order_attachments')
      .where({ id: attachmentId, repair_order_id: repairOrderId })
      .first()) as RepairOrderAttachment | undefined;

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    try {
      const isImage =
        attachment.mime_type.startsWith('image/') && attachment.mime_type !== 'image/gif';
      const fileExtension = attachment.original_name.split('.').pop() || '';

      if (isImage) {
        await Promise.all([
          this.storageService.delete(`${attachment.file_path}-small.${fileExtension}`),
          this.storageService.delete(`${attachment.file_path}-medium.${fileExtension}`),
          this.storageService.delete(`${attachment.file_path}-large.${fileExtension}`),
        ]);
      } else {
        await this.storageService.delete(`${attachment.file_path}.${fileExtension}`);
      }
    } catch (error) {
      console.warn('Failed to delete file from MinIO:', error);
    }

    await this.knex('repair_order_attachments').where({ id: attachmentId }).del();

    await this.changeLogger.logChange(
      repairOrderId,
      'attachment_deleted',
      {
        file_name: attachment.original_name,
      },
      admin.id,
    );

    return { message: 'Attachment deleted successfully' };
  }
}
