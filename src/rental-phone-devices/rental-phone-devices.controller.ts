import {
  Controller,
  Get,
  Post,
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
  ApiForbiddenResponse,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiUnauthorizedResponse,
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
  @ApiOperation({
    summary: 'List rental phone devices',
    description:
      'Returns a paginated list of rental phone devices with optional filtering by brand, status, condition, pricing, availability, and free-rent flag.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by device name, brand, model, code, or IMEI.',
    example: 'Galaxy',
  })
  @ApiQuery({
    name: 'brand',
    required: false,
    type: String,
    description: 'Filter results by brand name.',
    example: 'Samsung',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Available', 'Rented'],
    description: 'Filter by one or more rental statuses.',
    isArray: true,
    example: ['Available', 'Rented'],
  })
  @ApiQuery({
    name: 'condition',
    required: false,
    enum: ['Excellent', 'Good', 'Fair', 'Poor'],
    description: 'Filter by physical condition.',
    example: 'Good',
  })
  @ApiQuery({
    name: 'is_free',
    required: false,
    type: Boolean,
    description: 'Filter devices that are free of charge to rent.',
    example: false,
  })
  @ApiQuery({
    name: 'is_available',
    required: false,
    type: Boolean,
    description: 'Filter devices currently available for rental.',
    example: true,
  })
  @ApiQuery({
    name: 'min_price',
    required: false,
    type: Number,
    description: 'Minimum daily rental price.',
    example: 25000,
  })
  @ApiQuery({
    name: 'max_price',
    required: false,
    type: Number,
    description: 'Maximum daily rental price.',
    example: 100000,
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    enum: ['UZS', 'USD', 'EUR'],
    description: 'Filter by one or more supported currencies.',
    isArray: true,
    example: ['UZS', 'USD'],
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of records to skip before returning results.',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of records to return.',
    example: 20,
  })
  @ApiResponse({ status: 200, description: 'Paginated rental phone devices returned successfully.' })
  @ApiResponse({ status: 400, description: 'One or more query parameters are invalid.' })
  @ApiUnauthorizedResponse({ description: 'Authentication credentials were missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated admin does not have rental phone read permission.' })
  async findAll(
    @Query() dto: FindRentalPhoneDevicesDto,
  ): Promise<PaginationResult<RentalPhoneDevice>> {
    return this.rentalPhoneDevicesService.findAll(dto);
  }

  @Get('available')
  @SetPermissions('rental_phones_read')
  @ApiOperation({
    summary: 'List available rental phone devices',
    description: 'Returns all rental phone devices that are currently available to be assigned or rented.',
  })
  @ApiResponse({ status: 200, description: 'Available rental phone devices returned successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication credentials were missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated admin does not have rental phone read permission.' })
  async getAvailableDevices(): Promise<RentalPhoneDevice[]> {
    return this.rentalPhoneDevicesService.getAvailableDevices();
  }

  @Get('statistics')
  @SetPermissions('rental_phones_read')
  @ApiOperation({
    summary: 'Get rental phone inventory statistics',
    description: 'Returns aggregate metrics for the rental phone inventory, including availability, pricing, and total value.',
  })
  @ApiResponse({ status: 200, description: 'Rental phone inventory statistics returned successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication credentials were missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated admin does not have rental phone read permission.' })
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
  @ApiOperation({
    summary: 'List rental phone devices by brand',
    description: 'Returns all rental phone devices that match the provided brand name.',
  })
  @ApiParam({ name: 'brand', description: 'Brand name to filter by.', example: 'Samsung' })
  @ApiResponse({ status: 200, description: 'Rental phone devices for the specified brand returned successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication credentials were missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated admin does not have rental phone read permission.' })
  async getDevicesByBrand(@Param('brand') brand: string): Promise<RentalPhoneDevice[]> {
    return this.rentalPhoneDevicesService.getDevicesByBrand(brand);
  }

  @Get(':id')
  @SetPermissions('rental_phones_read')
  @ApiOperation({
    summary: 'Get rental phone device details',
    description: 'Returns a single rental phone device by its unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'Rental phone device UUID.',
    example: '9b7d7b45-ec0b-46f8-a5f8-7afbd06d4d3b',
  })
  @ApiResponse({ status: 200, description: 'Rental phone device returned successfully.' })
  @ApiResponse({ status: 400, description: 'The provided device ID is not a valid UUID.' })
  @ApiResponse({ status: 404, description: 'Rental phone device was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication credentials were missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated admin does not have rental phone read permission.' })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.findById(id);
  }

  @Post()
  @SetPermissions('rental_phones_create')
  @ApiOperation({
    summary: 'Create a rental phone device',
    description: 'Creates a new rental phone device record in the inventory.',
  })
  @ApiBody({
    type: CreateRentalPhoneDeviceDto,
    description: 'Payload used to create a rental phone device.',
  })
  @ApiResponse({ status: 201, description: 'Rental phone device created successfully.' })
  @ApiResponse({ status: 400, description: 'Request validation failed or the IMEI already exists.' })
  @ApiUnauthorizedResponse({ description: 'Authentication credentials were missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated admin does not have rental phone create permission.' })
  async create(@Body() dto: CreateRentalPhoneDeviceDto): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.create(dto);
  }

  @Patch(':id')
  @SetPermissions('rental_phones_update')
  @ApiOperation({
    summary: 'Update a rental phone device',
    description: 'Updates an existing rental phone device by its unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'Rental phone device UUID.',
    example: '9b7d7b45-ec0b-46f8-a5f8-7afbd06d4d3b',
  })
  @ApiBody({
    type: UpdateRentalPhoneDeviceDto,
    description: 'Payload used to update selected rental phone device fields.',
  })
  @ApiResponse({ status: 200, description: 'Rental phone device updated successfully.' })
  @ApiResponse({ status: 400, description: 'The request is invalid, the ID format is invalid, or the IMEI already exists.' })
  @ApiResponse({ status: 404, description: 'Rental phone device was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication credentials were missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated admin does not have rental phone update permission.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRentalPhoneDeviceDto,
  ): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.update(id, dto);
  }

  @Delete(':id')
  @SetPermissions('rental_phones_delete')
  @ApiOperation({
    summary: 'Delete a rental phone device',
    description: 'Deletes a rental phone device from the inventory by its unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'Rental phone device UUID.',
    example: '9b7d7b45-ec0b-46f8-a5f8-7afbd06d4d3b',
  })
  @ApiResponse({ status: 200, description: 'Rental phone device deleted successfully.' })
  @ApiResponse({ status: 400, description: 'The provided device ID is not a valid UUID.' })
  @ApiResponse({ status: 404, description: 'Rental phone device was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication credentials were missing or invalid.' })
  @ApiForbiddenResponse({ description: 'The authenticated admin does not have rental phone delete permission.' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.rentalPhoneDevicesService.delete(id);
    return { message: 'Device deleted successfully' };
  }
}
