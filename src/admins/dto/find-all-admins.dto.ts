import {
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
  IsIn,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToArray } from 'src/common/decorators/to-array.decorator';

export class FindAllAdminsDto {
  @ApiPropertyOptional({ description: 'Search by name, phone, passport, etc.' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    type: [String],
    enum: ['Open', 'Pending', 'Deleted', 'Banned'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Open', 'Pending', 'Deleted', 'Banned'], { each: true })
  @ToArray()
  status?: string[];

  @ApiPropertyOptional({
    description: 'Exclude by status',
    type: [String],
    enum: ['Open', 'Pending', 'Deleted', 'Banned'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Open', 'Pending', 'Deleted', 'Banned'], { each: true })
  @ToArray()
  exclude_status?: string[];

  @ApiPropertyOptional({
    description: 'Filter by branch IDs',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ToArray()
  branch_ids?: string[];

  @ApiPropertyOptional({
    description: 'Exclude by branch IDs',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ToArray()
  exclude_branch_ids?: string[];

  @ApiPropertyOptional({
    description: 'Filter by role IDs',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ToArray()
  role_ids?: string[];

  @ApiPropertyOptional({
    description: 'Exclude by role IDs',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ToArray()
  exclude_role_ids?: string[];

  @ApiPropertyOptional({ description: 'Pagination offset', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: 'Pagination limit', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
