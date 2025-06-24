import { Controller, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { DeliveryUpdaterService } from '../services/delivery-updater.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { CreateOrUpdateDeliveryDto } from '../dto/create-or-update-delivery.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Repair Orders Delivery')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:orderId/delivery')
export class DeliveryController {
  constructor(private readonly deliveryUpdater: DeliveryUpdaterService) {}

  @Post()
  async create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateOrUpdateDeliveryDto,
    @CurrentAdmin() admin: AdminPayload,
  ) {
    const result = await this.deliveryUpdater.create(orderId, dto, admin.id);
    return {
      message: '✅ Delivery created',
      delivery: result,
    };
  }

  @Patch()
  async update(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateOrUpdateDeliveryDto,
    @CurrentAdmin() admin: AdminPayload,
  ) {
    const result = await this.deliveryUpdater.update(orderId, dto, admin.id);
    return {
      message: '✏️ Delivery updated',
      delivery: result,
    };
  }

  @Delete()
  async delete(@Param('orderId') orderId: string, @CurrentAdmin() admin: AdminPayload) {
    return this.deliveryUpdater.delete(orderId, admin.id);
  }
}
