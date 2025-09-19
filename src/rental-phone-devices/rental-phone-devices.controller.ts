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
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['sort', 'created_at'] })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'] })
  async findAll(
    @Query() dto: FindRentalPhoneDevicesDto,
  ): Promise<PaginationResult<RentalPhoneDevice>> {
    return this.rentalPhoneDevicesService.findAll(dto);
  }
}
