import { IsOptional, IsString, IsEnum, IsInt, Min, MaxLength } from 'class-validator';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EnumBooleanString } from 'src/roles/dto/find-all-roles.dto';

export class FindRentalPhoneDevicesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;

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
  is_free?: EnumBooleanString;

  @ApiPropertyOptional({
    description: 'Filter by available roles (true/false)',
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

  @IsOptional()
  @IsEnum(['UZS', 'USD', 'EUR'])
  currency?: 'UZS' | 'USD' | 'EUR';

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
