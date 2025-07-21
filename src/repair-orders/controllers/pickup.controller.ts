import { Controller, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { PickupUpdaterService } from '../services/pickup-updater.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CreateOrUpdatePickupDto } from '../dto/create-or-update-pickup.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { RepairOrderPickup } from 'src/common/types/delivery-and-pickup.interface';

@ApiTags('Repair Orders Pickup')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:repair_order_id/pickup')
export class PickupController {
  constructor(private readonly pickupUpdater: PickupUpdaterService) {}

  @Post()
  async create(
    @Param('repair_order_id') orderId: string,
    @Body() dto: CreateOrUpdatePickupDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderPickup | undefined> {
    return this.pickupUpdater.create(orderId, dto, admin);
  }

  @Patch()
  async update(
    @Param('repair_order_id') orderId: string,
    @Body() dto: CreateOrUpdatePickupDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string } | undefined> {
    return this.pickupUpdater.update(orderId, dto, admin);
  }

  @Delete()
  async delete(
    @Param('repair_order_id') orderId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string } | undefined> {
    return this.pickupUpdater.delete(orderId, admin);
  }
}
