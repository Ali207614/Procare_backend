import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AttachmentsService, AttachmentResponse } from '../services/attachments.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@ApiTags('Repair Order Attachments')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post(':repair_order_id/attachments')
  @ApiOperation({ summary: 'Upload attachment to repair order' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { description?: string },
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<AttachmentResponse> {
    return this.attachmentsService.uploadAttachment(
      repairOrderId,
      file,
      body.description || '',
      admin,
    );
  }

  @Get(':repair_order_id/attachments')
  @ApiOperation({ summary: 'Get all attachments for repair order' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  async getAttachments(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<AttachmentResponse[]> {
    return this.attachmentsService.getAttachments(repairOrderId, admin);
  }

  @Delete(':repair_order_id/attachments/:attachment_id')
  @ApiOperation({ summary: 'Delete attachment from repair order' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  @ApiParam({ name: 'attachment_id', description: 'Attachment ID' })
  async deleteAttachment(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('attachment_id', ParseUUIDPipe) attachmentId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.attachmentsService.deleteAttachment(repairOrderId, attachmentId, admin);
  }
}
