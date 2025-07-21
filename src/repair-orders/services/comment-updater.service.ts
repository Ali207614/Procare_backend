import { BadRequestException, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrderComment } from 'src/common/types/repair-order-comment.interface';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@Injectable()
export class CommentUpdaterService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
  ) {}

  async update(
    commentId: string,
    newText: string,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const comment: RepairOrderComment | undefined = await this.knex('repair_order_comments')
      .select('repair_order_id', 'status_by', 'created_by', 'status', 'text')
      .where({ id: commentId })
      .first();

    if (!comment || comment.status === 'Deleted') {
      throw new BadRequestException({
        message: 'Comment not found or already deleted',
        location: 'comment_id',
      });
    }

    if (comment.created_by !== admin.id) {
      throw new BadRequestException({
        message: 'You are not the author of this comment',
        location: 'comment_id',
      });
    }

    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .select('branch_id', 'status_id')
      .where({ id: comment.repair_order_id, status: 'Open' })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found or already closed',
        location: 'repair_order_id',
      });
    }

    const allPermissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_comment'],
      'repair_order_comment',
      allPermissions,
    );

    if (comment.text === newText) {
      return { message: 'No changes detected' };
    }

    await this.knex('repair_order_comments')
      .where({ id: commentId })
      .update({ text: newText, updated_at: new Date() });

    await this.changeLogger.logIfChanged(
      this.knex,
      comment.repair_order_id,
      'comments',
      comment.text,
      newText,
      admin.id,
    );

    return { message: '✅ Comment updated' };
  }

  async create(
    orderId: string,
    comments: { text: string }[],
    admin: AdminPayload,
  ): Promise<RepairOrderComment | undefined> {
    if (!comments?.length) return;

    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .where({ id: orderId })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const allPermissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_comment'],
      'repair_order_comment',
      allPermissions,
    );

    const now = new Date();
    const rows = comments.map((c) => ({
      repair_order_id: orderId,
      text: c.text,
      status: 'Open',
      created_by: admin.id,
      status_by: order.status_id,
      created_at: now,
      updated_at: now,
    }));

    const inserted: RepairOrderComment[] = await this.knex('repair_order_comments')
      .insert(rows)
      .returning(['id', 'text', 'created_at']);

    await this.changeLogger.logIfChanged(this.knex, orderId, 'comments', null, comments, admin.id);

    return inserted[0];
  }

  async delete(commentId: string, admin: AdminPayload): Promise<void> {
    const comment: RepairOrderComment | undefined = await this.knex('repair_order_comments')
      .select('repair_order_id', 'status_by')
      .where({ id: commentId, status: 'Open' })
      .first();

    if (!comment) {
      throw new BadRequestException({
        message: 'Comment not found or already deleted',
        location: 'comment_id',
      });
    }

    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .where({ id: comment.repair_order_id, status: 'Open' })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const allPermissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_comment'],
      'repair_order_comment',
      allPermissions,
    );
    await this.knex('repair_order_comments')
      .where({ id: commentId })
      .update({ status: 'Deleted', updated_at: new Date() });

    await this.changeLogger.logIfChanged(
      this.knex,
      comment.repair_order_id,
      'comments',
      'deleted',
      commentId,
      admin.id,
    );
  }
}
