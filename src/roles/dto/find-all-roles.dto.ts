import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export enum EnumBooleanString {
  TRUE = 'true',
  FALSE = 'false',
}

export class FindAllRolesDto {
  @ApiPropertyOptional({
    example: 'admin',
    description: 'Search by role name (case-insensitive)',
  })
  @IsOptional()
  @IsString({ context: { location: 'search' } })
  @MinLength(1, { context: { location: 'search_min' } })
  @MaxLength(100, { context: { location: 'search_min' } })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active roles (true/false)',
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
  is_active?: EnumBooleanString;

  @ApiPropertyOptional({
    description: 'Filter by protected roles (true/false)',
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
  is_protected?: EnumBooleanString;

  @ApiPropertyOptional({
    example: 20,
    description: 'Number of items per page',
  })
  @IsOptional()
  @IsInt({ context: { location: 'limit' } })
  @Min(1, { context: { location: 'limit_min' } })
  @Max(100, { context: { location: 'limit_max' } })
  limit = 20;

  @ApiPropertyOptional({
    example: 0,
    description: 'Offset for pagination (starting index)',
  })
  @IsOptional()
  @IsInt({ context: { location: 'offset' } })
  @Min(0, { context: { location: 'offset_min' } })
  offset = 0;
}
