import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly changeLogger: RepairOrderChangeLoggerService,
    private readonly permissionService: RepairOrderStatusPermissionsService,
  ) {}

  async uploadAttachment(repairOrderId: string, file: Express.Multer.File, description: string, admin: AdminPayload) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const order = await this.knex('repair_orders').where({ id: repairOrderId }).first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
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

    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const uploadPath = path.join(process.cwd(), 'uploads', 'repair-orders', repairOrderId);

    await fs.mkdir(uploadPath, { recursive: true });

    const filePath = path.join(uploadPath, fileName);
    await fs.writeFile(filePath, file.buffer);

    const attachment = await this.knex('repair_order_attachments')
      .insert({
        id: uuidv4(),
        repair_order_id: repairOrderId,
        original_name: file.originalname,
        file_name: fileName,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.mimetype,
        description: description || null,
        uploaded_by: admin.id,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    await this.changeLogger.logChange(repairOrderId, 'attachment_uploaded', {
      file_name: file.originalname,
      description
    }, admin.id);

    return attachment[0];
  }

  async getAttachments(repairOrderId: string, admin: AdminPayload) {
    const order = await this.knex('repair_orders').where({ id: repairOrderId }).first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_view'],
      'repair_order_view',
      permissions,
    );

    return this.knex('repair_order_attachments')
      .where({ repair_order_id: repairOrderId })
      .orderBy('created_at', 'desc');
  }

  async deleteAttachment(repairOrderId: string, attachmentId: string, admin: AdminPayload) {
    const order = await this.knex('repair_orders').where({ id: repairOrderId }).first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_delete'],
      'repair_order_delete',
      permissions,
    );

    const attachment = await this.knex('repair_order_attachments')
      .where({ id: attachmentId, repair_order_id: repairOrderId })
      .first();

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    try {
      await fs.unlink(attachment.file_path);
    } catch (error) {
      console.warn('Failed to delete file from filesystem:', error);
    }

    await this.knex('repair_order_attachments')
      .where({ id: attachmentId })
      .del();

    await this.changeLogger.logChange(repairOrderId, 'attachment_deleted', {
      file_name: attachment.original_name
    }, admin.id);

    return { message: 'Attachment deleted successfully' };
  }
}