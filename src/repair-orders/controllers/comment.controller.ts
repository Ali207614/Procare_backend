import { Controller, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { CommentUpdaterService } from '../services/comment-updater.service';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';

@ApiTags('Repair Orders Comment')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller()
export class CommentController {
    constructor(private readonly commentUpdater: CommentUpdaterService) { }

    @Post('repair-orders/:orderId/comments')
    async create(
        @Param('orderId', ParseUUIDPipe) orderId: string,
        @Body() dto: CreateCommentDto,
        @CurrentAdmin() admin: AdminPayload,
    ) {
        return await this.commentUpdater.create(orderId, [dto], admin.id);
    }

    @Patch('comments/:commentId')
    async update(
        @Param('commentId', ParseUUIDPipe) commentId: string,
        @Body() dto: CreateCommentDto,
        @CurrentAdmin() admin: AdminPayload,
    ) {
        return this.commentUpdater.update(commentId, dto.text, admin.id);
    }

    @Delete('comments/:commentId')
    async delete(
        @Param('commentId', ParseUUIDPipe) commentId: string,
        @CurrentAdmin() admin: AdminPayload,
    ) {
        await this.commentUpdater.delete(commentId, admin.id);
        return { message: '🗑️ Comment deleted' };
    }
}
