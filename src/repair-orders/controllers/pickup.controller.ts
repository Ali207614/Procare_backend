import { Controller, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { PickupUpdaterService } from '../services/pickup-updater.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CreateOrUpdatePickupDto } from '../dto/create-or-update-pickup.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';

@ApiTags('Repair Orders Pickup')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:orderId/pickup')
export class PickupController {
  constructor(private readonly pickupUpdater: PickupUpdaterService) {}

  @Post()
  async create(
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrUpdatePickupDto,
    @CurrentAdmin() admin: AdminPayload,
  ) {
    const result = await this.pickupUpdater.create(orderId, dto, admin.id);
    return {
      message: '✅ Pickup created',
      pickup: result,
    };
  }

  @Patch()
  async update(
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrUpdatePickupDto,
    @CurrentAdmin() admin: AdminPayload,
  ) {
    const result = await this.pickupUpdater.update(orderId, dto, admin.id);
    return {
      message: '✏️ Pickup updated',
      pickup: result,
    };
  }

  @Delete()
  async delete(@Param('orderId') orderId: string, @CurrentAdmin() admin: AdminPayload) {
    return this.pickupUpdater.delete(orderId, admin.id);
  }
}
