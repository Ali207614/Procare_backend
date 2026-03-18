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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { RepairOrderRentalPhone } from 'src/common/types/repair-order-rental-phone.interface';

@ApiTags('Repair Orders Rental Phone')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:repair_order_id/rental-phone')
export class RentalPhoneController {
  constructor(private readonly rentalPhoneUpdater: RentalPhoneUpdaterService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a rental phone for a repair order',
    description: 'Creates and assigns a rental phone entry to the specified repair order.',
  })
  async create(
    @Param('repair_order_id') orderId: string,
    @Body() dto: CreateOrUpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderRentalPhone> {
    return this.rentalPhoneUpdater.create(orderId, dto, admin);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update rental phone details for a repair order',
    description:
      'Updates the rental phone information currently attached to the specified repair order.',
  })
  async update(
    @Param('repair_order_id') orderId: string,
    @Body() dto: CreateOrUpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.rentalPhoneUpdater.update(orderId, dto, admin);
  }

  @Delete()
  @ApiOperation({
    summary: 'Cancel the rental phone for a repair order',
    description: 'Removes the rental phone assignment from the specified repair order.',
  })
  async delete(
    @Param('repair_order_id') orderId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    await this.rentalPhoneUpdater.delete(orderId, admin);
    return { message: 'Rental phone cancelled' };
  }

  @Patch(':rental_phone_id')
  @ApiOperation({
    summary: 'Update a specific rental phone record',
    description: 'Updates a rental phone record by its ID within the specified repair order.',
  })
  async updateRentalPhone(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('rental_phone_id', ParseUUIDPipe) rentalPhoneId: string,
    @Body() updateDto: UpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderRentalPhone> {
    return this.rentalPhoneUpdater.updateRentalPhone(
      repairOrderId,
      rentalPhoneId,
      updateDto,
      admin,
    );
  }

  @Delete(':rental_phone_id')
  @ApiOperation({
    summary: 'Delete a specific rental phone record',
    description: 'Deletes a rental phone record by its ID from the specified repair order.',
  })
  async removeRentalPhone(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('rental_phone_id', ParseUUIDPipe) rentalPhoneId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.rentalPhoneUpdater.removeRentalPhone(repairOrderId, rentalPhoneId, admin);
  }
}
