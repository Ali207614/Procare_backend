/*
https://docs.nestjs.com/controllers#controllers
*/

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { FindRentalPhoneDevicesDto } from './dto/find-rental-phone-devices.dto';
import { RentalPhoneDevicesService } from './rental-phone-devices.service';
@ApiTags('Rental Phones')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('rental-phones')
export class RentalPhoneDevicesController {
  constructor(private readonly rentalPhoneDevicesService: RentalPhoneDevicesService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['sort', 'created_at'] })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'] })
  async findAll(@Query() dto: FindRentalPhoneDevicesDto) {
    return this.rentalPhoneDevicesService.findAll(dto);
  }
}
