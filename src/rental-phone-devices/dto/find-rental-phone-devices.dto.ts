import { IsOptional, IsString, IsEnum, IsInt, Min, MaxLength, IsNumber } from 'class-validator';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EnumBooleanString } from 'src/roles/dto/find-all-roles.dto';

export class FindRentalPhoneDevicesDto {
  @ApiPropertyOptional({ description: 'Search in name, brand, model, code, or IMEI' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by brand (Samsung, iPhone, etc)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand?: string;

  @ApiPropertyOptional({
    description: 'Filter by device status',
    enum: ['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired'],
  })
  @IsOptional()
  @IsEnum(['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired'])
  status?: 'Available' | 'Rented' | 'Maintenance' | 'Lost' | 'Damaged' | 'Retired';

  @ApiPropertyOptional({
    description: 'Filter by device condition',
    enum: ['Excellent', 'Good', 'Fair', 'Poor'],
  })
  @IsOptional()
  @IsEnum(['Excellent', 'Good', 'Fair', 'Poor'])
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';

  @ApiPropertyOptional({
    description: 'Filter by free devices (true/false)',
    enum: EnumBooleanString,
    example: EnumBooleanString.TRUE,
  })
  @IsOptional()
  @IsEnum(EnumBooleanString, { message: 'Filter must be true or false' })
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return EnumBooleanString.TRUE;
      if (lower === 'false') return EnumBooleanString.FALSE;
      return value;
    }
    return value as EnumBooleanString;
  })
  is_free?: EnumBooleanString;

  @ApiPropertyOptional({
    description: 'Filter by availability (true/false)',
    enum: EnumBooleanString,
    example: EnumBooleanString.TRUE,
  })
  @IsOptional()
  @IsEnum(EnumBooleanString, { message: 'Filter must be true or false' })
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return EnumBooleanString.TRUE;
      if (lower === 'false') return EnumBooleanString.FALSE;
      return value;
    }
    return value as EnumBooleanString;
  })
  is_available?: EnumBooleanString;

  @ApiPropertyOptional({ description: 'Minimum daily rent price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  min_price?: number;

  @ApiPropertyOptional({ description: 'Maximum daily rent price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  max_price?: number;

  @ApiPropertyOptional({ description: 'Filter by currency', enum: ['UZS', 'USD', 'EUR'] })
  @IsOptional()
  @IsEnum(['UZS', 'USD', 'EUR'])
  currency?: 'UZS' | 'USD' | 'EUR';

  @ApiPropertyOptional({ description: 'Pagination offset' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Pagination limit' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;
}
