import { Controller, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { DeliveryUpdaterService } from '../services/delivery-updater.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { CreateOrUpdateDeliveryDto } from '../dto/create-or-update-delivery.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RepairOrderDelivery } from 'src/common/types/delivery-and-pickup.interface';

@ApiTags('Repair Orders Delivery')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:repair_order_id/delivery')
export class DeliveryController {
  constructor(private readonly deliveryUpdater: DeliveryUpdaterService) {}

  @Post()
  async create(
    @Param('repair_order_id', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateOrUpdateDeliveryDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderDelivery | undefined> {
    return this.deliveryUpdater.create(orderId, dto, admin);
  }

  @Patch(':delivery_id')
  async update(
    @Param('delivery_id', ParseUUIDPipe) delivery_id: string,
    @Body() dto: CreateOrUpdateDeliveryDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string } | undefined> {
    return this.deliveryUpdater.update(delivery_id, dto, admin);
  }

  @Delete(':delivery_id')
  async delete(
    @Param('delivery_id') delivery_id: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string } | undefined> {
    return this.deliveryUpdater.delete(delivery_id, admin);
  }
}
