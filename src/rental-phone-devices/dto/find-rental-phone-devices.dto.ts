import { IsOptional, IsString, IsBoolean, IsEnum, IsInt, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class FindRentalPhoneDevicesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_free?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_available?: boolean;

  @IsOptional()
  @IsEnum(['UZS', 'USD', 'EUR'])
  currency?: 'UZS' | 'USD' | 'EUR';

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sort?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;
}
