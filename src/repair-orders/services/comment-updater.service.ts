import { BadRequestException, Injectable } from "@nestjs/common";
import { Knex } from "knex";
import { InjectKnex } from "nestjs-knex";
import { RepairOrderStatusPermissionsService } from "src/repair-order-status-permission/repair-order-status-permissions.service";
import { RepairOrderChangeLoggerService } from "./repair-order-change-logger.service";

@Injectable()
export class CommentUpdaterService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
    ) { }

    async update(commentId: string, newText: string, adminId: string) {
        const comment = await this.knex('repair_order_comments')
            .select('repair_order_id', 'status_by', 'created_by', 'status', 'text')
            .where({ id: commentId })
            .first();

        if (!comment || comment.status === 'Deleted') {
            throw new BadRequestException({
                message: 'Comment not found or already deleted',
                location: 'comment_id',
            });
        }

        if (comment.created_by !== adminId) {
            throw new BadRequestException({
                message: 'You are not the author of this comment',
                location: 'comment_id',
            });
        }

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            comment.status_by,
            'can_comment',
            'comments',
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
            adminId,
        );

        return { message: '✅ Comment updated' };
    }

    async create(orderId: string, comments: { text: string }[], adminId: string) {
        if (!comments?.length) return;

        const status = await this.knex('repair_orders')
            .select('status_id')
            .where({ id: orderId })
            .first();

        if (!status) {
            throw new BadRequestException({
                message: 'Repair order not found',
                location: 'repair_order_id',
            });
        }

        const statusId = status.status_id;

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            statusId,
            'can_comment',
            'comments',
        );

        const now = new Date();
        const rows = comments.map((c) => ({
            repair_order_id: orderId,
            text: c.text,
            status: 'Open',
            created_by: adminId,
            status_by: statusId,
            created_at: now,
            updated_at: now,
        }));

        const inserted = await this.knex('repair_order_comments')
            .insert(rows)
            .returning(['id', 'text', 'created_at']);

        await this.changeLogger.logIfChanged(
            this.knex,
            orderId,
            'comments',
            null,
            comments,
            adminId,
        );

        return inserted[0];
    }

    async delete(commentId: string, adminId: string) {
        const comment = await this.knex('repair_order_comments')
            .select('repair_order_id', 'status_by')
            .where({ id: commentId, status: 'Open' })
            .first();

        if (!comment) {
            throw new BadRequestException({
                message: 'Comment not found or already deleted',
                location: 'comment_id',
            });
        }

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            comment.status_by,
            'can_comment',
            'comments',
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
            adminId,
        );
    }
}
