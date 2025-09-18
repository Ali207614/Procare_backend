import {
  IsOptional,
  IsString,
  IsArray,
  IsIn,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllUsersDto {
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
  status_ids?: string[];

  @ApiPropertyOptional({
    description: 'Exclude by status',
    type: [String],
    enum: ['Pending', 'Open', 'Deleted', 'Banned'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Pending', 'Open', 'Deleted', 'Banned'], { each: true })
  exclude_status_ids?: string[];

  @ApiPropertyOptional({
    description: 'Filter by source',
    type: [String],
    enum: ['telegram_bot', 'employee', 'web', 'app', 'other'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['telegram_bot', 'employee', 'web', 'app', 'other'], { each: true })
  source?: string[];

  @ApiPropertyOptional({
    description: 'Exclude by source',
    type: [String],
    enum: ['telegram_bot', 'employee', 'web', 'app', 'other'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['telegram_bot', 'employee', 'web', 'app', 'other'], { each: true })
  exclude_source?: string[];

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
