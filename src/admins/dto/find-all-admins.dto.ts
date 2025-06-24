import { IsOptional, IsString, IsArray, IsUUID, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllAdminsDto {
  @ApiPropertyOptional({ description: 'Search by name, phone, passport, etc.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    type: [String],
    enum: ['Open', 'Pending', 'Deleted', 'Banned'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Open', 'Pending', 'Deleted', 'Banned'], { each: true })
  status?: string[];

  @ApiPropertyOptional({
    description: 'Filter by branch IDs',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  branch_ids?: string[];

  @ApiPropertyOptional({
    description: 'Filter by role IDs',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  role_ids?: string[];

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
