import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RentalPhoneDeviceResponseDto {
  @ApiProperty({
    description: 'Rental phone device UUID.',
    format: 'uuid',
    example: '9b7d7b45-ec0b-46f8-a5f8-7afbd06d4d3b',
  })
  id!: string;

  @ApiProperty({
    description: 'Human-readable inventory name displayed to admins.',
    example: 'Samsung Galaxy A14',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Device brand. Null when the brand is not recorded.',
    example: 'Samsung',
    nullable: true,
  })
  brand!: string | null;

  @ApiPropertyOptional({
    description: 'Device model. Null when the model is not recorded.',
    example: 'Galaxy A14',
    nullable: true,
  })
  model!: string | null;

  @ApiPropertyOptional({
    description: 'IMEI used to identify a physical rental phone. Must be unique when present.',
    example: '351756061523456',
    nullable: true,
  })
  imei!: string | null;

  @ApiPropertyOptional({
    description: 'Device color.',
    example: 'Black',
    nullable: true,
  })
  color!: string | null;

  @ApiPropertyOptional({
    description: 'Storage capacity label.',
    example: '128GB',
    nullable: true,
  })
  storage_capacity!: string | null;

  @ApiPropertyOptional({
    description: 'Battery capacity label.',
    example: '5000mAh',
    nullable: true,
  })
  battery_capacity!: string | null;

  @ApiProperty({
    description: '`true` when the device can be rented without a daily fee.',
    example: false,
  })
  is_free!: boolean;

  @ApiProperty({
    description: 'Daily rental price in the selected currency.',
    example: 25000,
    minimum: 0,
  })
  daily_rent_price!: number;

  @ApiProperty({
    description: 'Security deposit amount in the selected currency.',
    example: 100000,
    minimum: 0,
  })
  deposit_amount!: number;

  @ApiProperty({
    description: 'Currency used for the rental price and deposit.',
    enum: ['UZS', 'USD', 'EUR'],
    example: 'UZS',
  })
  currency!: 'UZS' | 'USD' | 'EUR';

  @ApiProperty({
    description: '`true` when at least one unit can currently be assigned to a repair order.',
    example: true,
  })
  is_available!: boolean;

  @ApiProperty({
    description: 'Inventory lifecycle status.',
    enum: ['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired'],
    example: 'Available',
  })
  status!: 'Available' | 'Rented' | 'Maintenance' | 'Lost' | 'Damaged' | 'Retired';

  @ApiProperty({
    description: 'Physical condition of the device.',
    enum: ['Excellent', 'Good', 'Fair', 'Poor'],
    example: 'Good',
  })
  condition!: 'Excellent' | 'Good' | 'Fair' | 'Poor';

  @ApiProperty({
    description: 'Total inventory quantity for this device record.',
    example: 1,
    minimum: 1,
  })
  quantity!: number;

  @ApiProperty({
    description: 'Quantity still available for rental assignment.',
    example: 1,
    minimum: 0,
  })
  quantity_available!: number;

  @ApiPropertyOptional({
    description: 'Internal admin notes.',
    example: 'Includes protective case and charger.',
    nullable: true,
  })
  notes!: string | null;

  @ApiPropertyOptional({
    description: 'Additional device specifications stored as a JSON string.',
    example: '{"ram":"4GB","camera":"50MP"}',
    nullable: true,
  })
  specifications!: string | null;

  @ApiProperty({
    description: 'Admin-controlled display order. Lower values are shown first.',
    example: 1,
    minimum: 1,
  })
  sort!: number;

  @ApiPropertyOptional({
    description: 'Most recent rental start timestamp for this device.',
    format: 'date-time',
    example: '2026-05-10T09:00:00.000Z',
    nullable: true,
  })
  rented_at?: string | null;

  @ApiPropertyOptional({
    description: 'Most recent return timestamp for this device.',
    format: 'date-time',
    example: '2026-05-13T09:00:00.000Z',
    nullable: true,
  })
  returned_at?: string | null;

  @ApiProperty({
    description: 'Record creation timestamp.',
    format: 'date-time',
    example: '2026-05-10T08:30:00.000Z',
  })
  created_at!: string;

  @ApiProperty({
    description: 'Last update timestamp.',
    format: 'date-time',
    example: '2026-05-10T08:45:00.000Z',
  })
  updated_at!: string;
}

export class RentalPhoneDeviceListMetaDto {
  @ApiProperty({ description: 'Total records matching the filter.', example: 42 })
  total!: number;

  @ApiProperty({ description: 'Maximum number of records returned in this page.', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Number of records skipped before this page.', example: 0 })
  offset!: number;
}

export class RentalPhoneDeviceListResponseDto {
  @ApiProperty({ type: RentalPhoneDeviceListMetaDto })
  meta!: RentalPhoneDeviceListMetaDto;

  @ApiProperty({ type: [RentalPhoneDeviceResponseDto] })
  data!: RentalPhoneDeviceResponseDto[];
}

export class RentalPhoneDeviceStatisticsResponseDto {
  @ApiProperty({ description: 'Number of non-retired rental phone records.', example: 25 })
  totalDevices!: number;

  @ApiProperty({ description: 'Number of devices with `Available` status.', example: 17 })
  availableDevices!: number;

  @ApiProperty({ description: 'Number of devices with `Rented` status.', example: 5 })
  rentedDevices!: number;

  @ApiProperty({ description: 'Number of devices with `Maintenance` status.', example: 3 })
  maintenanceDevices!: number;

  @ApiProperty({
    description: 'Inventory value calculated as `daily_rent_price * quantity` across devices.',
    example: 625000,
  })
  totalValue!: number;

  @ApiProperty({
    description: 'Average daily rental price across non-retired devices.',
    example: 25000,
  })
  averagePrice!: number;
}

export class RentalPhoneDeviceDeleteResponseDto {
  @ApiProperty({
    description: 'Human-readable delete confirmation.',
    example: 'Device deleted successfully',
  })
  message!: string;
}

export class RentalPhoneDeviceErrorResponseDto {
  @ApiProperty({ description: 'HTTP status code.', example: 400 })
  statusCode!: number;

  @ApiProperty({
    description: 'Human-readable error message.',
    example: 'Device with this IMEI already exists',
  })
  message!: string;

  @ApiProperty({
    description: 'Machine-readable error type.',
    example: 'BadRequestException',
  })
  error!: string;

  @ApiProperty({
    description:
      'Stable localization key used by the frontend notification system. Each business case has a distinct value.',
    example: 'rental_phone_device_create_imei_exists',
    nullable: true,
  })
  location!: string | null;

  @ApiProperty({
    description: 'Error timestamp generated by the global exception filter.',
    format: 'date-time',
    example: '2026-05-10T09:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Request path.',
    example: '/api/v1/rental-phone-devices',
  })
  path!: string;
}
