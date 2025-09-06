import { Controller, Get, Param, Patch, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { FindNotificationsDto } from './dto/find-notification.dto';
import { NotificationService } from './notification.service';
import { Notification } from 'src/common/types/notification.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiQuery({ name: 'is_read', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Notifications' })
  async findAll(
    @Query() query: FindNotificationsDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<PaginationResult<Notification>> {
    return this.service.findAll(admin.id, query);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.service.markAsRead(admin.id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentAdmin() admin: AdminPayload): Promise<{ message: string }> {
    return this.service.markAllAsRead(admin.id);
  }
}
