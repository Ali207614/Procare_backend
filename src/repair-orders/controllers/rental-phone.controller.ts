import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RentalPhoneUpdaterService } from '../services/rental-phone-updater.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CreateOrUpdateRentalPhoneDto } from '../dto/create-or-update-rental-phone.dto';
import { UpdateRentalPhoneDto } from '../dto/update-rental-phone.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { RepairOrderRentalPhone } from 'src/common/types/repair-order-rental-phone.interface';

@ApiTags('Repair Orders Rental Phone')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:repair_order_id/rental-phone')
export class RentalPhoneController {
  constructor(private readonly rentalPhoneUpdater: RentalPhoneUpdaterService) {}

  @Post()
  async create(
    @Param('repair_order_id') orderId: string,
    @Body() dto: CreateOrUpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderRentalPhone> {
    return this.rentalPhoneUpdater.create(orderId, dto, admin);
  }

  @Patch()
  async update(
    @Param('repair_order_id') orderId: string,
    @Body() dto: CreateOrUpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.rentalPhoneUpdater.update(orderId, dto, admin);
  }

  @Delete()
  async delete(
    @Param('repair_order_id') orderId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    await this.rentalPhoneUpdater.delete(orderId, admin);
    return { message: 'Rental phone cancelled' };
  }

  @Patch(':rental_phone_id')
  async updateRentalPhone(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('rental_phone_id', ParseUUIDPipe) rentalPhoneId: string,
    @Body() updateDto: UpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.rentalPhoneUpdater.updateRentalPhone(
      repairOrderId,
      rentalPhoneId,
      updateDto,
      admin,
    );
  }

  @Delete(':rental_phone_id')
  async removeRentalPhone(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('rental_phone_id', ParseUUIDPipe) rentalPhoneId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.rentalPhoneUpdater.removeRentalPhone(repairOrderId, rentalPhoneId, admin);
  }
}
