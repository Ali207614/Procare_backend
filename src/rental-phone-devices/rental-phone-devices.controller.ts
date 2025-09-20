import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { FindRentalPhoneDevicesDto } from './dto/find-rental-phone-devices.dto';
import { RentalPhoneDevicesService } from './rental-phone-devices.service';
import { RentalPhoneDevice } from 'src/common/types/rental-phone-device.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
@ApiTags('Rental Phones')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('rental-phones')
export class RentalPhoneDevicesController {
  constructor(private readonly rentalPhoneDevicesService: RentalPhoneDevicesService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'is_free', required: false, type: Boolean })
  @ApiQuery({ name: 'is_available', required: false, type: Boolean })
  @ApiQuery({ name: 'currency', required: false, enum: ['UZS', 'USD', 'EUR'] })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query() dto: FindRentalPhoneDevicesDto,
  ): Promise<PaginationResult<RentalPhoneDevice>> {
    return this.rentalPhoneDevicesService.findAll(dto);
  }
}
