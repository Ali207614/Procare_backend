import {
  IsOptional,
  IsString,
  IsArray,
  IsIn,
  IsInt,
  Min,
  MaxLength,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToArray } from 'src/common/decorators/to-array.decorator';

export enum HasTelegramFilter {
  TRUE = 'true',
  FALSE = 'false',
}

export class UserFiltersDto {
  @ApiPropertyOptional({ description: 'Search by name, phone, passport, etc.' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    type: [String],
    enum: ['Pending', 'Open', 'Deleted', 'Banned'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Pending', 'Open', 'Deleted', 'Banned'], { each: true })
  @ToArray()
  status_ids?: string[];

  @ApiPropertyOptional({
    description: 'Exclude by status',
    type: [String],
    enum: ['Pending', 'Open', 'Deleted', 'Banned'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Pending', 'Open', 'Deleted', 'Banned'], { each: true })
  @ToArray()
  exclude_status_ids?: string[];

  @ApiPropertyOptional({
    description: 'Filter by source',
    type: [String],
    enum: ['telegram_bot', 'employee', 'web', 'app', 'other'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['telegram_bot', 'employee', 'web', 'app', 'other'], { each: true })
  @ToArray()
  source?: string[];

  @ApiPropertyOptional({
    description: 'Exclude by source',
    type: [String],
    enum: ['telegram_bot', 'employee', 'web', 'app', 'other'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['telegram_bot', 'employee', 'web', 'app', 'other'], { each: true })
  @ToArray()
  exclude_source?: string[];

  @ApiPropertyOptional({
    description: 'Filter users with or without Telegram',
    enum: HasTelegramFilter,
    example: HasTelegramFilter.TRUE,
  })
  @IsOptional()
  @IsEnum(HasTelegramFilter, { message: 'has_telegram must be true or false' })
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return HasTelegramFilter.TRUE;
      if (lower === 'false') return HasTelegramFilter.FALSE;

      return value;
    }
    return value as HasTelegramFilter;
  })
  has_telegram?: HasTelegramFilter;

  @ApiPropertyOptional({
    description: 'Filter by language',
    type: String,
    enum: ['uz', 'ru', 'en'],
    example: 'uz',
  })
  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  language?: string;

  @ApiPropertyOptional({
    description: 'Birth date start (inclusive)',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDateString()
  birth_date_start?: string;

  @ApiPropertyOptional({
    description: 'Birth date end (inclusive)',
    example: '2000-12-31',
  })
  @IsOptional()
  @IsDateString()
  birth_date_end?: string;

  @ApiPropertyOptional({
    description: 'Created date start (inclusive)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  created_at_start?: string;

  @ApiPropertyOptional({
    description: 'Created date end (inclusive)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  created_at_end?: string;
}

export class FindAllUsersDto extends UserFiltersDto {
  @ApiPropertyOptional({ description: 'Pagination offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: 'Pagination limit', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
