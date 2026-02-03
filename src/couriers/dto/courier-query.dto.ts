import { IsOptional, IsUUID, IsInt, Min, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CourierQueryDto {
  @ApiProperty({ description: 'Branch ID', example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  @IsUUID()
  branch_id!: string;

  @ApiPropertyOptional({ description: 'Search by name, phone, passport, etc.' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters' })
  search?: string;

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
