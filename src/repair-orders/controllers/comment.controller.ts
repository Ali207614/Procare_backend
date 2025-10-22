import { Controller, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { CommentUpdaterService } from '../services/comment-updater.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { RepairOrderComment } from 'src/common/types/repair-order-comment.interface';
import { CreateCommentDto } from '../dto/create-comment.dto';

@ApiTags('Repair Orders Comment')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller()
export class CommentController {
  constructor(private readonly commentUpdater: CommentUpdaterService) {}

  @Post('repair-orders/:repair_order_id/comments')
  async create(
    @Param('repair_order_id', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateCommentDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderComment | undefined> {
    return await this.commentUpdater.create(orderId, [dto], admin);
  }

  @Patch('comments/:comment_id')
  async update(
    @Param('comment_id', ParseUUIDPipe) commentId: string,
    @Body() dto: CreateCommentDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.commentUpdater.update(commentId, dto.text, admin);
  }

  @Delete('comments/:comment_id')
  async delete(
    @Param('comment_id', ParseUUIDPipe) commentId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    await this.commentUpdater.delete(commentId, admin);
    return { message: '🗑️ Comment deleted' };
  }
}
