import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { FindRentalPhoneDevicesDto } from './dto/find-rental-phone-devices.dto';
import { CreateRentalPhoneDeviceDto } from './dto/create-rental-phone-device.dto';
import { UpdateRentalPhoneDeviceDto } from './dto/update-rental-phone-device.dto';
import { RentalPhoneDevicesService } from './rental-phone-devices.service';
import { RentalPhoneDevice } from 'src/common/types/rental-phone-device.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';

@ApiTags('Rental Phone Devices')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard, PermissionsGuard)
@Controller('rental-phone-devices')
export class RentalPhoneDevicesController {
  constructor(private readonly rentalPhoneDevicesService: RentalPhoneDevicesService) {}

  @Get()
  @SetPermissions('rental_phones_read')
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({ summary: 'Get all rental phone devices' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name, brand, model, or IMEI',
  })
  @ApiQuery({ name: 'brand', required: false, type: String, description: 'Filter by brand' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired'],
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'condition',
    required: false,
    enum: ['Excellent', 'Good', 'Fair', 'Poor'],
    description: 'Filter by condition',
  })
  @ApiQuery({
    name: 'is_free',
    required: false,
    type: Boolean,
    description: 'Filter by free devices',
  })
  @ApiQuery({
    name: 'is_available',
    required: false,
    type: Boolean,
    description: 'Filter by available devices',
  })
  @ApiQuery({
    name: 'min_price',
    required: false,
    type: Number,
    description: 'Minimum daily rent price',
  })
  @ApiQuery({
    name: 'max_price',
    required: false,
    type: Number,
    description: 'Maximum daily rent price',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    enum: ['UZS', 'USD', 'EUR'],
    description: 'Filter by currency',
  })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Pagination offset' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Pagination limit' })
  @ApiResponse({ status: 200, description: 'List of rental phone devices' })
  async findAll(
    @Query() dto: FindRentalPhoneDevicesDto,
  ): Promise<PaginationResult<RentalPhoneDevice>> {
    return this.rentalPhoneDevicesService.findAll(dto);
  }

  @Get('available')
  @SetPermissions('rental_phones_read')
  @ApiOperation({ summary: 'Get all available rental phone devices' })
  @ApiResponse({ status: 200, description: 'List of available rental phone devices' })
  async getAvailableDevices(): Promise<RentalPhoneDevice[]> {
    return this.rentalPhoneDevicesService.getAvailableDevices();
  }

  @Get('statistics')
  @SetPermissions('rental_phones_read')
  @ApiOperation({ summary: 'Get rental phone devices statistics' })
  @ApiResponse({ status: 200, description: 'Statistics data' })
  async getStatistics(): Promise<{
    totalDevices: number;
    availableDevices: number;
    rentedDevices: number;
    maintenanceDevices: number;
    totalValue: number;
    averagePrice: number;
  }> {
    return this.rentalPhoneDevicesService.getStatistics();
  }

  @Get('brands/:brand')
  @SetPermissions('rental_phones_read')
  @ApiOperation({ summary: 'Get devices by brand' })
  @ApiParam({ name: 'brand', description: 'Brand name' })
  @ApiResponse({ status: 200, description: 'List of devices for the specified brand' })
  async getDevicesByBrand(@Param('brand') brand: string): Promise<RentalPhoneDevice[]> {
    return this.rentalPhoneDevicesService.getDevicesByBrand(brand);
  }

  @Get(':id')
  @SetPermissions('rental_phones_read')
  @ApiOperation({ summary: 'Get rental phone device by ID' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiResponse({ status: 200, description: 'Rental phone device details' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.findById(id);
  }

  @Post()
  @SetPermissions('rental_phones_create')
  @ApiOperation({ summary: 'Create new rental phone device' })
  @ApiBody({ type: CreateRentalPhoneDeviceDto })
  @ApiResponse({ status: 201, description: 'Device created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or duplicate IMEI' })
  async create(@Body() dto: CreateRentalPhoneDeviceDto): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.create(dto);
  }

  @Put(':id')
  @SetPermissions('rental_phones_update')
  @ApiOperation({ summary: 'Update rental phone device' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiBody({ type: UpdateRentalPhoneDeviceDto })
  @ApiResponse({ status: 200, description: 'Device updated successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  @ApiResponse({ status: 400, description: 'Invalid input or duplicate IMEI' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRentalPhoneDeviceDto,
  ): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.update(id, dto);
  }

  @Patch(':id/quantity')
  @SetPermissions('rental_phones_update')
  @ApiOperation({ summary: 'Update device quantity (for rentals/returns)' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quantityChange: {
          type: 'number',
          description: 'Quantity change (negative for rent, positive for return)',
        },
      },
      required: ['quantityChange'],
    },
  })
  @ApiResponse({ status: 200, description: 'Device quantity updated successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  @ApiResponse({ status: 400, description: 'Insufficient quantity or invalid operation' })
  async updateQuantity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quantityChange') quantityChange: number,
  ): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.updateQuantity(id, quantityChange);
  }

  @Delete(':id')
  @SetPermissions('rental_phones_delete')
  @ApiOperation({ summary: 'Delete rental phone device' })
  @ApiParam({ name: 'id', description: 'Device UUID' })
  @ApiResponse({ status: 200, description: 'Device deleted successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.rentalPhoneDevicesService.delete(id);
    return { message: 'Device deleted successfully' };
  }
}
