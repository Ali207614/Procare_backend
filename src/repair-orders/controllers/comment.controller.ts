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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { CreateCommentDto } from '../dto/create-comment.dto';
import {
  CreatedRepairOrderCommentDto,
  DeleteRepairOrderCommentResponseDto,
  FindRepairOrderCommentsDto,
  RepairOrderCommentsResponseDto,
  UpdateRepairOrderCommentResponseDto,
} from '../dto/repair-order-comments.dto';

const REPAIR_ORDER_ID_EXAMPLE = '7c54c7bd-c01e-4e95-ae70-c88283f61f2b';
const COMMENT_ID_EXAMPLE = 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb';

function errorResponseSchema(
  statusCode: number,
  message: string,
  error: string,
  location: string | null,
  path: string,
): SchemaObject {
  return {
    type: 'object',
    required: ['statusCode', 'message', 'error', 'location', 'timestamp', 'path'],
    properties: {
      statusCode: { type: 'number', example: statusCode },
      message: { type: 'string', example: message },
      error: { type: 'string', example: error },
      location: { type: 'string', nullable: true, example: location },
      timestamp: { type: 'string', format: 'date-time', example: '2026-04-30T08:15:00.000Z' },
      path: { type: 'string', example: path },
    },
  };
}

@ApiTags('Repair Order Comments')
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
    operationId: 'findRepairOrderComments',
    description: [
      'Returns a paginated timeline of open repair-order comments visible to the authenticated admin.',
      '',
      'Use `type=manual` or `type=history` for a single type, or `types=manual,history` / repeated `types` params for multiple types.',
      '',
      'Comments are ordered newest first. Use `offset` and `limit` to page older comments, similar to messenger timelines.',
      '',
      'Audio files are linked from local `phone_calls` rows, and each `download_url` is refreshed from OnlinePBX before the response is returned.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'repair_order_id',
    description: 'Repair order UUID whose comments should be returned.',
    example: REPAIR_ORDER_ID_EXAMPLE,
  })
  @ApiQuery({
    name: 'types',
    required: false,
    enum: ['manual', 'history'],
    isArray: true,
    description:
      'Filter by one or more comment types. Supports repeated params and comma-separated values.',
    example: ['manual', 'history'],
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['manual', 'history'],
    description: 'Convenience filter for a single comment type.',
    example: 'manual',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of comments to skip before returning results.',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of comments to return. The service caps this value at 100.',
    example: 20,
  })
  @ApiOkResponse({
    description: 'Paginated comments plus cached OnlinePBX audio files for the repair order.',
    type: RepairOrderCommentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID or query validation failed.',
    schema: errorResponseSchema(
      400,
      'Invalid UUID format',
      'BadRequestException',
      'params_id',
      `/api/v1/repair-orders/${REPAIR_ORDER_ID_EXAMPLE}/comments`,
    ),
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing, expired, or invalid.',
    schema: errorResponseSchema(
      401,
      'Unauthorized',
      'UnauthorizedException',
      null,
      `/api/v1/repair-orders/${REPAIR_ORDER_ID_EXAMPLE}/comments`,
    ),
  })
  @ApiForbiddenResponse({
    description: 'The authenticated admin cannot view comments in the current repair-order status.',
    schema: errorResponseSchema(
      403,
      "Ushbu amalni bajarish uchun sizda yetarli ruxsat yo'q.",
      'ForbiddenException',
      'repair_order_comments_view',
      `/api/v1/repair-orders/${REPAIR_ORDER_ID_EXAMPLE}/comments`,
    ),
  })
  @ApiNotFoundResponse({
    description: 'Repair order was not found.',
    schema: errorResponseSchema(
      404,
      'Order not found',
      'NotFound',
      'repair_order_id',
      `/api/v1/repair-orders/${REPAIR_ORDER_ID_EXAMPLE}/comments`,
    ),
  })
  async findByRepairOrder(
    @Param('repair_order_id', ParseUUIDPipe) orderId: string,
    @Query() query: FindRepairOrderCommentsDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderCommentsResponseDto> {
    return this.commentReader.findByRepairOrder(admin, orderId, query);
  }

  @Post('repair-orders/:repair_order_id/comments')
  @ApiOperation({
    summary: 'Create a repair order comment',
    operationId: 'createRepairOrderComment',
    description: [
      'Creates one manual comment on an open repair order.',
      '',
      'Only admins with `can_comment` permission for the repair order branch and current status can create comments.',
      '',
      'The created comment is also written to repair-order change history.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'repair_order_id',
    description: 'Repair order UUID that will receive the manual comment.',
    example: REPAIR_ORDER_ID_EXAMPLE,
  })
  @ApiBody({
    type: CreateCommentDto,
    description: 'Manual comment payload. `text` is required and must be 1000 characters or less.',
    examples: {
      standard: {
        summary: 'Manual note',
        value: {
          text: 'Customer asked to confirm the screen replacement price before repair starts.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Comment created successfully. The response contains the fields returned by the insert operation.',
    type: CreatedRepairOrderCommentDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid UUID, validation failure, missing repair order, or comment permission setup error.',
    schema: errorResponseSchema(
      400,
      'Repair order not found',
      'BadRequestException',
      'repair_order_id',
      `/api/v1/repair-orders/${REPAIR_ORDER_ID_EXAMPLE}/comments`,
    ),
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing, expired, or invalid.',
    schema: errorResponseSchema(
      401,
      'Unauthorized',
      'UnauthorizedException',
      null,
      `/api/v1/repair-orders/${REPAIR_ORDER_ID_EXAMPLE}/comments`,
    ),
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated admin does not have comment permission in the current repair-order status.',
    schema: errorResponseSchema(
      403,
      "Ushbu amalni bajarish uchun sizda yetarli ruxsat yo'q.",
      'ForbiddenException',
      'repair_order_comment',
      `/api/v1/repair-orders/${REPAIR_ORDER_ID_EXAMPLE}/comments`,
    ),
  })
  async create(
    @Param('repair_order_id', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateCommentDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<CreatedRepairOrderCommentDto | undefined> {
    return await this.commentUpdater.create(orderId, [dto], admin);
  }

  @Patch('comments/:comment_id')
  @ApiOperation({
    summary: 'Update a repair order comment',
    operationId: 'updateRepairOrderComment',
    description: [
      'Updates the text of an existing manual comment.',
      '',
      'Only the original author can update the comment. Generated history comments cannot be edited.',
      '',
      'The repair order must still be open, and the admin must have `can_comment` permission for its current status.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'comment_id',
    description: 'Manual comment UUID to update.',
    example: COMMENT_ID_EXAMPLE,
  })
  @ApiBody({
    type: CreateCommentDto,
    description:
      'Replacement comment text. `text` is required and must be 1000 characters or less.',
    examples: {
      editedText: {
        summary: 'Edited manual note',
        value: {
          text: 'Customer approved the quoted screen replacement price by phone.',
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Comment updated successfully, or no write was performed because the submitted text matched the current text.',
    type: UpdateRepairOrderCommentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid UUID, validation failure, comment not found, deleted comment, non-author edit, history comment edit, or closed/missing repair order.',
    schema: errorResponseSchema(
      400,
      'You are not the author of this comment',
      'BadRequestException',
      'comment_id',
      `/api/v1/comments/${COMMENT_ID_EXAMPLE}`,
    ),
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing, expired, or invalid.',
    schema: errorResponseSchema(
      401,
      'Unauthorized',
      'UnauthorizedException',
      null,
      `/api/v1/comments/${COMMENT_ID_EXAMPLE}`,
    ),
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated admin does not have comment permission in the current repair-order status.',
    schema: errorResponseSchema(
      403,
      "Ushbu amalni bajarish uchun sizda yetarli ruxsat yo'q.",
      'ForbiddenException',
      'repair_order_comment',
      `/api/v1/comments/${COMMENT_ID_EXAMPLE}`,
    ),
  })
  async update(
    @Param('comment_id', ParseUUIDPipe) commentId: string,
    @Body() dto: CreateCommentDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.commentUpdater.update(commentId, dto.text, admin);
  }

  @Delete('comments/:comment_id')
  @ApiOperation({
    summary: 'Delete a repair order comment',
    operationId: 'deleteRepairOrderComment',
    description: [
      'Soft-deletes an existing manual comment by setting its status to `Deleted`.',
      '',
      'Generated history comments cannot be deleted. The repair order must still be open, and the admin must have `can_comment` permission for its current status.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'comment_id',
    description: 'Manual comment UUID to soft-delete.',
    example: COMMENT_ID_EXAMPLE,
  })
  @ApiOkResponse({
    description: 'Comment soft-deleted successfully.',
    type: DeleteRepairOrderCommentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid UUID, comment not found, already deleted comment, history comment delete, or missing repair order.',
    schema: errorResponseSchema(
      400,
      'Comment not found or already deleted',
      'BadRequestException',
      'comment_id',
      `/api/v1/comments/${COMMENT_ID_EXAMPLE}`,
    ),
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing, expired, or invalid.',
    schema: errorResponseSchema(
      401,
      'Unauthorized',
      'UnauthorizedException',
      null,
      `/api/v1/comments/${COMMENT_ID_EXAMPLE}`,
    ),
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated admin does not have comment permission in the current repair-order status.',
    schema: errorResponseSchema(
      403,
      "Ushbu amalni bajarish uchun sizda yetarli ruxsat yo'q.",
      'ForbiddenException',
      'repair_order_comment',
      `/api/v1/comments/${COMMENT_ID_EXAMPLE}`,
    ),
  })
  async delete(
    @Param('comment_id', ParseUUIDPipe) commentId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<DeleteRepairOrderCommentResponseDto> {
    await this.commentUpdater.delete(commentId, admin);
    return { message: '🗑️ Comment deleted' };
  }
}
