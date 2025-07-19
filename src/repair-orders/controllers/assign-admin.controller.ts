import { Controller, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AssignAdminUpdaterService } from '../services/assign-admin-updater.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { AssignAdminsDto } from '../dto/assign-admin.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';

@ApiTags('Repair Orders Assign Admin')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:repair_order_id/assign-admins')
export class AssignAdminController {
  constructor(private readonly assignAdminUpdater: AssignAdminUpdaterService) {}

  @Post()
  async assignAdmins(
    @Param('repair_order_id', ParseUUIDPipe) orderId: string,
    @Body() dto: AssignAdminsDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    await this.assignAdminUpdater.create(orderId, dto.admin_ids, admin.id);
    return { message: '✅ Admins assigned successfully' };
  }

  @Delete(':admin_id')
  async removeAdmin(
    @Param('repair_order_id', ParseUUIDPipe) orderId: string,
    @Param('admin_id', ParseUUIDPipe) adminId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    await this.assignAdminUpdater.delete(orderId, adminId, admin.id);
    return { message: '🗑️ Admin removed from order' };
  }
}
