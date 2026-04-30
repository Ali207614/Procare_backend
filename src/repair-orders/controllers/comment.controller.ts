import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import { CommentUpdaterService } from '../services/comment-updater.service';
import { CommentReaderService } from '../services/comment-reader.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { RepairOrderComment } from 'src/common/types/repair-order-comment.interface';
import { CreateCommentDto } from '../dto/create-comment.dto';
import {
  FindRepairOrderCommentsDto,
  RepairOrderCommentsResponseDto,
} from '../dto/repair-order-comments.dto';

@ApiTags('Repair Orders Comment')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller()
export class CommentController {
  constructor(
    private readonly commentUpdater: CommentUpdaterService,
    private readonly commentReader: CommentReaderService,
  ) {}

  @Get('repair-orders/:repair_order_id/comments')
  @ApiOperation({
    summary: 'Get repair order comments',
    description: [
      'Fast, paginated read endpoint for repair-order comments.',
      '',
      'Use `type=manual` or `type=history` for a single type, or `types=manual,history` / repeated `types` params for multiple types.',
      '',
      'Audio files are linked from local `phone_calls` rows, and each `download_url` is refreshed from OnlinePBX before the response is returned.',
    ].join('\n'),
  })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  @ApiOkResponse({
    description: 'Paginated comments plus cached OnlinePBX audio files for the repair order.',
    type: RepairOrderCommentsResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Repair order was not found.',
  })
  async findByRepairOrder(
    @Param('repair_order_id', ParseUUIDPipe) orderId: string,
    @Query() query: FindRepairOrderCommentsDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderCommentsResponseDto> {
    return this.commentReader.findByRepairOrder(admin, orderId, query);
  }

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
