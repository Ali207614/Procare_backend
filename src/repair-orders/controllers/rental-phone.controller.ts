import { Controller, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { RentalPhoneUpdaterService } from '../services/rental-phone-updater.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CreateOrUpdateRentalPhoneDto } from '../dto/create-or-update-rental-phone.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';

@ApiTags('Repair Orders Rental Phone')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:orderId/rental-phone')
export class RentalPhoneController {
  constructor(private readonly rentalPhoneUpdater: RentalPhoneUpdaterService) {}

  @Post()
  async create(
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrUpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ) {
    const result = await this.rentalPhoneUpdater.create(orderId, dto, admin.id);
    return {
      message: '✅ Rental phone assigned',
      rental_phone: result,
    };
  }

  @Patch()
  async update(
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrUpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ) {
    return this.rentalPhoneUpdater.update(orderId, dto, admin.id);
  }

  @Delete()
  async delete(@Param('orderId') orderId: string, @CurrentAdmin() admin: AdminPayload) {
    await this.rentalPhoneUpdater.delete(orderId, admin.id);
    return { message: '🗑️ Rental phone cancelled' };
  }
}
