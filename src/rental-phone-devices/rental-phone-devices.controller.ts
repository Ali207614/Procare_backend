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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { FindRentalPhoneDevicesDto } from './dto/find-rental-phone-devices.dto';
import { CreateRentalPhoneDeviceDto } from './dto/create-rental-phone-device.dto';
import { UpdateRentalPhoneDeviceDto } from './dto/update-rental-phone-device.dto';
import {
  RentalPhoneDeviceDeleteResponseDto,
  RentalPhoneDeviceErrorResponseDto,
  RentalPhoneDeviceListResponseDto,
  RentalPhoneDeviceResponseDto,
  RentalPhoneDeviceStatisticsResponseDto,
} from './dto/rental-phone-device-response.dto';
import { RentalPhoneDevicesService } from './rental-phone-devices.service';
import { RentalPhoneDevice } from 'src/common/types/rental-phone-device.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';

const RENTAL_PHONE_DEVICE_ID_EXAMPLE = '9b7d7b45-ec0b-46f8-a5f8-7afbd06d4d3b';

const rentalPhoneDeviceExample = {
  id: RENTAL_PHONE_DEVICE_ID_EXAMPLE,
  name: 'Samsung Galaxy A14',
  brand: 'Samsung',
  model: 'Galaxy A14',
  imei: '351756061523456',
  color: 'Black',
  storage_capacity: '128GB',
  battery_capacity: '5000mAh',
  is_free: false,
  daily_rent_price: 25000,
  deposit_amount: 100000,
  currency: 'UZS',
  is_available: true,
  status: 'Available',
  condition: 'Good',
  quantity: 1,
  quantity_available: 1,
  notes: 'Includes protective case and charger.',
  specifications: '{"ram":"4GB","camera":"50MP"}',
  sort: 1,
  rented_at: null,
  returned_at: null,
  created_at: '2026-05-10T08:30:00.000Z',
  updated_at: '2026-05-10T08:45:00.000Z',
};

const unauthorizedResponseExample = {
  statusCode: 401,
  message: 'Invalid token',
  error: 'UnauthorizedException',
  location: 'invalid_token',
  timestamp: '2026-05-10T09:00:00.000Z',
  path: '/api/v1/rental-phone-devices',
};

const forbiddenResponseExample = {
  statusCode: 403,
  message: 'Permission denied',
  error: 'ForbiddenException',
  location: 'permission_denied',
  timestamp: '2026-05-10T09:00:00.000Z',
  path: '/api/v1/rental-phone-devices',
};

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
      'Returns a paginated inventory list for the admin rental-phone catalog. Results are sorted by `sort` and then `name`. When `status` is not provided, only `Available` and `Rented` devices are returned by default.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Case-insensitive search across device name, brand, model, and IMEI.',
    example: 'Galaxy',
  })
  @ApiQuery({
    name: 'brand',
    required: false,
    type: String,
    description: 'Exact brand filter.',
    example: 'Samsung',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Available', 'Rented'],
    description:
      'Filter by one or more visible inventory statuses. Repeat the query parameter for multiple values, for example `?status=Available&status=Rented`.',
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
    enum: ['true', 'false'],
    description: 'Filter by whether rental is free. Sent as a query string value.',
    example: 'false',
  })
  @ApiQuery({
    name: 'is_available',
    required: false,
    enum: ['true', 'false'],
    description: 'Filter by whether at least one unit can currently be assigned to a repair order.',
    example: 'true',
  })
  @ApiQuery({
    name: 'min_price',
    required: false,
    type: Number,
    description: 'Minimum daily rental price, inclusive.',
    example: 25000,
  })
  @ApiQuery({
    name: 'max_price',
    required: false,
    type: Number,
    description: 'Maximum daily rental price, inclusive.',
    example: 100000,
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    enum: ['UZS', 'USD', 'EUR'],
    description:
      'Filter by one or more supported currencies. Repeat the query parameter for multiple values, for example `?currency=UZS&currency=USD`.',
    isArray: true,
    example: ['UZS', 'USD'],
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of matching records to skip before returning this page.',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of records returned in this page.',
    example: 20,
  })
  @ApiOkResponse({
    type: RentalPhoneDeviceListResponseDto,
    description:
      'Paginated rental phone devices. The controller returns `rows`, `total`, `limit`, and `offset`; `PaginationInterceptor` exposes them as `{ meta, data }`.',
    example: {
      meta: { total: 1, limit: 20, offset: 0 },
      data: [rentalPhoneDeviceExample],
    },
  })
  @ApiBadRequestResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description:
      'Invalid query parameter. Validation errors use the invalid query field as `location`, for example `search`, `is_free`, `min_price`, or `limit`.',
    example: {
      statusCode: 400,
      message: 'Filter must be true or false',
      error: 'ValidationError',
      location: 'is_free',
      timestamp: '2026-05-10T09:00:00.000Z',
      path: '/api/v1/rental-phone-devices?is_free=yes',
    },
  })
  @ApiUnauthorizedResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'Missing, malformed, expired, or blacklisted admin JWT.',
    example: unauthorizedResponseExample,
  })
  @ApiForbiddenResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The authenticated admin does not have `rental_phones_read` permission.',
    example: forbiddenResponseExample,
  })
  async findAll(
    @Query() dto: FindRentalPhoneDevicesDto,
  ): Promise<PaginationResult<RentalPhoneDevice>> {
    return this.rentalPhoneDevicesService.findAll(dto);
  }

  @Get('available')
  @SetPermissions('rental_phones_read')
  @ApiOperation({
    summary: 'List assignable rental phone devices',
    description:
      'Returns every device with `status = Available`, `is_available = true`, and `quantity_available > 0`. Use this endpoint for dropdowns and assignment flows where pagination is not needed.',
  })
  @ApiOkResponse({
    type: [RentalPhoneDeviceResponseDto],
    description: 'Assignable rental phone devices sorted by display order and rental price.',
    example: [rentalPhoneDeviceExample],
  })
  @ApiUnauthorizedResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'Missing, malformed, expired, or blacklisted admin JWT.',
    example: unauthorizedResponseExample,
  })
  @ApiForbiddenResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The authenticated admin does not have `rental_phones_read` permission.',
    example: forbiddenResponseExample,
  })
  async getAvailableDevices(): Promise<RentalPhoneDevice[]> {
    return this.rentalPhoneDevicesService.getAvailableDevices();
  }

  @Get('statistics')
  @SetPermissions('rental_phones_read')
  @ApiOperation({
    summary: 'Get rental phone inventory statistics',
    description:
      'Returns aggregate inventory counters and pricing metrics for non-retired rental phone devices. This is intended for dashboard widgets and inventory summaries.',
  })
  @ApiOkResponse({
    type: RentalPhoneDeviceStatisticsResponseDto,
    description: 'Rental phone inventory statistics returned successfully.',
    example: {
      totalDevices: 25,
      availableDevices: 17,
      rentedDevices: 5,
      maintenanceDevices: 3,
      totalValue: 625000,
      averagePrice: 25000,
    },
  })
  @ApiUnauthorizedResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'Missing, malformed, expired, or blacklisted admin JWT.',
    example: unauthorizedResponseExample,
  })
  @ApiForbiddenResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The authenticated admin does not have `rental_phones_read` permission.',
    example: forbiddenResponseExample,
  })
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
    summary: 'List available devices by brand',
    description:
      'Returns available devices for one exact brand. The brand value is read from the URL path, so clients should URL-encode values that contain spaces or special characters.',
  })
  @ApiParam({
    name: 'brand',
    description: 'Exact brand name to match.',
    example: 'Samsung',
  })
  @ApiOkResponse({
    type: [RentalPhoneDeviceResponseDto],
    description: 'Available rental phone devices for the specified brand.',
    example: [rentalPhoneDeviceExample],
  })
  @ApiUnauthorizedResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'Missing, malformed, expired, or blacklisted admin JWT.',
    example: unauthorizedResponseExample,
  })
  @ApiForbiddenResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The authenticated admin does not have `rental_phones_read` permission.',
    example: forbiddenResponseExample,
  })
  async getDevicesByBrand(@Param('brand') brand: string): Promise<RentalPhoneDevice[]> {
    return this.rentalPhoneDevicesService.getDevicesByBrand(brand);
  }

  @Get(':id')
  @SetPermissions('rental_phones_read')
  @ApiOperation({
    summary: 'Get rental phone device details',
    description:
      'Returns one rental phone device by UUID, including its inventory fields and most recent rental/return timestamps.',
  })
  @ApiParam({
    name: 'id',
    description: 'Rental phone device UUID.',
    format: 'uuid',
    example: RENTAL_PHONE_DEVICE_ID_EXAMPLE,
  })
  @ApiOkResponse({
    type: RentalPhoneDeviceResponseDto,
    description: 'Rental phone device returned successfully.',
    example: rentalPhoneDeviceExample,
  })
  @ApiBadRequestResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The provided device ID is missing or is not a valid UUID.',
    example: {
      statusCode: 400,
      message: 'Invalid UUID format',
      error: 'BadRequestException',
      location: 'rental_phone_device_id',
      timestamp: '2026-05-10T09:00:00.000Z',
      path: '/api/v1/rental-phone-devices/not-a-uuid',
    },
  })
  @ApiNotFoundResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'No rental phone device exists for the provided UUID.',
    example: {
      statusCode: 404,
      message: 'Rental phone device not found',
      error: 'NotFound',
      location: 'device_not_found',
      timestamp: '2026-05-10T09:00:00.000Z',
      path: `/api/v1/rental-phone-devices/${RENTAL_PHONE_DEVICE_ID_EXAMPLE}`,
    },
  })
  @ApiUnauthorizedResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'Missing, malformed, expired, or blacklisted admin JWT.',
    example: unauthorizedResponseExample,
  })
  @ApiForbiddenResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The authenticated admin does not have `rental_phones_read` permission.',
    example: forbiddenResponseExample,
  })
  async findById(
    @Param('id', new ParseUUIDPipe({ location: 'rental_phone_device_id' })) id: string,
  ): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.findById(id);
  }

  @Post()
  @SetPermissions('rental_phones_create')
  @ApiOperation({
    summary: 'Create a rental phone device',
    description:
      'Creates a new rental phone inventory record and writes a history entry for the authenticated admin. `quantity_available` must not exceed `quantity`; when availability fields are omitted, the service derives a consistent initial availability from status and quantity.',
  })
  @ApiBody({
    type: CreateRentalPhoneDeviceDto,
    description:
      'Rental phone inventory fields. Required fields are `name`, `daily_rent_price`, and `currency`.',
  })
  @ApiCreatedResponse({
    type: RentalPhoneDeviceResponseDto,
    description: 'Rental phone device created successfully.',
    example: rentalPhoneDeviceExample,
  })
  @ApiBadRequestResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description:
      'Request validation failed or a business rule failed. Business-rule `location` values are unique for create cases: `rental_phone_device_create_imei_exists` and `rental_phone_device_create_invalid_quantity`.',
    example: {
      statusCode: 400,
      message: 'Device with this IMEI already exists',
      error: 'BadRequestException',
      location: 'rental_phone_device_create_imei_exists',
      timestamp: '2026-05-10T09:00:00.000Z',
      path: '/api/v1/rental-phone-devices',
    },
  })
  @ApiUnauthorizedResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'Missing, malformed, expired, or blacklisted admin JWT.',
    example: unauthorizedResponseExample,
  })
  @ApiForbiddenResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The authenticated admin does not have `rental_phones_create` permission.',
    example: forbiddenResponseExample,
  })
  async create(
    @CurrentAdmin() admin: AdminPayload,
    @Body() dto: CreateRentalPhoneDeviceDto,
  ): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.create(dto, admin.id);
  }

  @Patch(':id')
  @SetPermissions('rental_phones_update')
  @ApiOperation({
    summary: 'Update a rental phone device',
    description:
      'Partially updates an existing rental phone inventory record and records an admin history entry. Updating status away from `Available` automatically clears availability; changing status back to `Available` recalculates `is_available` from `quantity_available`.',
  })
  @ApiParam({
    name: 'id',
    description: 'Rental phone device UUID.',
    format: 'uuid',
    example: RENTAL_PHONE_DEVICE_ID_EXAMPLE,
  })
  @ApiBody({
    type: UpdateRentalPhoneDeviceDto,
    description: 'Any subset of editable rental phone inventory fields. Empty bodies are rejected.',
  })
  @ApiOkResponse({
    type: RentalPhoneDeviceResponseDto,
    description: 'Rental phone device updated successfully.',
    example: {
      ...rentalPhoneDeviceExample,
      daily_rent_price: 30000,
      updated_at: '2026-05-10T09:10:00.000Z',
    },
  })
  @ApiBadRequestResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description:
      'Invalid UUID, request validation failure, empty update body, or a business-rule failure. Business-rule `location` values are unique for update cases: `rental_phone_device_update_imei_exists`, `rental_phone_device_update_invalid_quantity`, and `empty_update_data`.',
    example: {
      statusCode: 400,
      message: 'Device with this IMEI already exists',
      error: 'BadRequestException',
      location: 'rental_phone_device_update_imei_exists',
      timestamp: '2026-05-10T09:00:00.000Z',
      path: `/api/v1/rental-phone-devices/${RENTAL_PHONE_DEVICE_ID_EXAMPLE}`,
    },
  })
  @ApiNotFoundResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'No rental phone device exists for the provided UUID.',
    example: {
      statusCode: 404,
      message: 'Rental phone device not found',
      error: 'NotFound',
      location: 'device_not_found',
      timestamp: '2026-05-10T09:00:00.000Z',
      path: `/api/v1/rental-phone-devices/${RENTAL_PHONE_DEVICE_ID_EXAMPLE}`,
    },
  })
  @ApiUnauthorizedResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'Missing, malformed, expired, or blacklisted admin JWT.',
    example: unauthorizedResponseExample,
  })
  @ApiForbiddenResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The authenticated admin does not have `rental_phones_update` permission.',
    example: forbiddenResponseExample,
  })
  async update(
    @CurrentAdmin() admin: AdminPayload,
    @Param('id', new ParseUUIDPipe({ location: 'rental_phone_device_id' })) id: string,
    @Body() dto: UpdateRentalPhoneDeviceDto,
  ): Promise<RentalPhoneDevice> {
    return this.rentalPhoneDevicesService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @SetPermissions('rental_phones_delete')
  @ApiOperation({
    summary: 'Retire a rental phone device',
    description:
      'Soft-deletes a rental phone device by marking it unavailable and setting `status` to `Retired`. The device record remains in the database for history and audit purposes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Rental phone device UUID.',
    format: 'uuid',
    example: RENTAL_PHONE_DEVICE_ID_EXAMPLE,
  })
  @ApiOkResponse({
    type: RentalPhoneDeviceDeleteResponseDto,
    description: 'Rental phone device retired successfully.',
    example: { message: 'Device deleted successfully' },
  })
  @ApiBadRequestResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The provided device ID is missing or is not a valid UUID.',
    example: {
      statusCode: 400,
      message: 'Invalid UUID format',
      error: 'BadRequestException',
      location: 'rental_phone_device_id',
      timestamp: '2026-05-10T09:00:00.000Z',
      path: '/api/v1/rental-phone-devices/not-a-uuid',
    },
  })
  @ApiNotFoundResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'No rental phone device exists for the provided UUID.',
    example: {
      statusCode: 404,
      message: 'Rental phone device not found',
      error: 'NotFound',
      location: 'device_not_found',
      timestamp: '2026-05-10T09:00:00.000Z',
      path: `/api/v1/rental-phone-devices/${RENTAL_PHONE_DEVICE_ID_EXAMPLE}`,
    },
  })
  @ApiUnauthorizedResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'Missing, malformed, expired, or blacklisted admin JWT.',
    example: unauthorizedResponseExample,
  })
  @ApiForbiddenResponse({
    type: RentalPhoneDeviceErrorResponseDto,
    description: 'The authenticated admin does not have `rental_phones_delete` permission.',
    example: forbiddenResponseExample,
  })
  async delete(
    @CurrentAdmin() admin: AdminPayload,
    @Param('id', new ParseUUIDPipe({ location: 'rental_phone_device_id' })) id: string,
  ): Promise<{ message: string }> {
    await this.rentalPhoneDevicesService.delete(id, admin.id);
    return { message: 'Device deleted successfully' };
  }
}
