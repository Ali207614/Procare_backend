import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsEnum,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRentalPhoneDeviceDto {
  @ApiPropertyOptional({ example: 'RD001', description: 'Unique device code' })
  @IsOptional()
  @IsString({ context: { location: 'code' } })
  @MinLength(2, { context: { location: 'code' } })
  @MaxLength(50, { context: { location: 'code' } })
  code?: string;

  @ApiPropertyOptional({ example: 'Samsung Galaxy A14', description: 'Device display name' })
  @IsOptional()
  @IsString({ context: { location: 'name' } })
  @MinLength(2, { context: { location: 'name' } })
  @MaxLength(100, { context: { location: 'name' } })
  name?: string;

  @ApiPropertyOptional({ example: 'Samsung', description: 'Phone brand' })
  @IsOptional()
  @IsString({ context: { location: 'brand' } })
  @MaxLength(50, { context: { location: 'brand' } })
  brand?: string;

  @ApiPropertyOptional({ example: 'Galaxy A14', description: 'Phone model' })
  @IsOptional()
  @IsString({ context: { location: 'model' } })
  @MaxLength(50, { context: { location: 'model' } })
  model?: string;

  @ApiPropertyOptional({ example: '351756061523456', description: 'IMEI number' })
  @IsOptional()
  @IsString({ context: { location: 'imei' } })
  @MaxLength(20, { context: { location: 'imei' } })
  imei?: string;

  @ApiPropertyOptional({ example: 'R2J505X0ABC', description: 'Serial number' })
  @IsOptional()
  @IsString({ context: { location: 'serial_number' } })
  @MaxLength(50, { context: { location: 'serial_number' } })
  serial_number?: string;

  @ApiPropertyOptional({ example: 'Black', description: 'Device color' })
  @IsOptional()
  @IsString({ context: { location: 'color' } })
  @MaxLength(30, { context: { location: 'color' } })
  color?: string;

  @ApiPropertyOptional({ example: '128GB', description: 'Storage capacity' })
  @IsOptional()
  @IsString({ context: { location: 'storage_capacity' } })
  @MaxLength(20, { context: { location: 'storage_capacity' } })
  storage_capacity?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether the device is free to rent' })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_free' } })
  is_free?: boolean;

  @ApiPropertyOptional({ example: 25000, description: 'Daily rental price' })
  @IsOptional()
  @IsNumber({}, { context: { location: 'daily_rent_price' } })
  @Min(0, { context: { location: 'daily_rent_price' } })
  daily_rent_price?: number;

  @ApiPropertyOptional({ example: 100000, description: 'Security deposit amount' })
  @IsOptional()
  @IsNumber({}, { context: { location: 'deposit_amount' } })
  @Min(0, { context: { location: 'deposit_amount' } })
  deposit_amount?: number;

  @ApiPropertyOptional({
    example: 'UZS',
    enum: ['UZS', 'USD', 'EUR'],
    description: 'Price currency',
  })
  @IsOptional()
  @IsEnum(['UZS', 'USD', 'EUR'], { context: { location: 'currency' } })
  currency?: 'UZS' | 'USD' | 'EUR';

  @ApiPropertyOptional({ example: true, description: 'Whether the device is available for rent' })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_available' } })
  is_available?: boolean;

  @ApiPropertyOptional({
    example: 'Available',
    enum: ['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired'],
    description: 'Device status',
  })
  @IsOptional()
  @IsEnum(['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired'], {
    context: { location: 'status' },
  })
  status?: 'Available' | 'Rented' | 'Maintenance' | 'Lost' | 'Damaged' | 'Retired';

  @ApiPropertyOptional({
    example: 'Good',
    enum: ['Excellent', 'Good', 'Fair', 'Poor'],
    description: 'Device condition',
  })
  @IsOptional()
  @IsEnum(['Excellent', 'Good', 'Fair', 'Poor'], { context: { location: 'condition' } })
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';

  @ApiPropertyOptional({ example: 1, description: 'Total quantity of this device type' })
  @IsOptional()
  @IsNumber({}, { context: { location: 'quantity' } })
  @Min(1, { context: { location: 'quantity' } })
  @Max(100, { context: { location: 'quantity' } })
  quantity?: number;

  @ApiPropertyOptional({ example: 1, description: 'Available quantity for rent' })
  @IsOptional()
  @IsNumber({}, { context: { location: 'quantity_available' } })
  @Min(0, { context: { location: 'quantity_available' } })
  quantity_available?: number;

  @ApiPropertyOptional({
    example: 'Premium rental device with case',
    description: 'Additional notes',
  })
  @IsOptional()
  @IsString({ context: { location: 'notes' } })
  @MaxLength(500, { context: { location: 'notes' } })
  notes?: string;

  @ApiPropertyOptional({
    example: '{"ram":"4GB","camera":"50MP"}',
    description: 'Device specifications as JSON string',
  })
  @IsOptional()
  @IsString({ context: { location: 'specifications' } })
  @MaxLength(1000, { context: { location: 'specifications' } })
  specifications?: string;

  @ApiPropertyOptional({ example: 1, description: 'Sort order for display' })
  @IsOptional()
  @IsNumber({}, { context: { location: 'sort' } })
  @Min(1, { context: { location: 'sort' } })
  @Max(9999, { context: { location: 'sort' } })
  sort?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether the device is active' })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_active' } })
  is_active?: boolean;
}
