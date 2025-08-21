import { IsOptional, IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from './pagination-query.dto';

export class FindAllCampaignsDto extends PaginationQueryDto {
  @ApiProperty({
    enum: ['queued', 'scheduled', 'sending', 'paused', 'completed', 'failed'],
    description: 'Campaign status',
    required: false,
  })
  @IsOptional()
  @IsEnum(['queued', 'scheduled', 'sending', 'paused', 'completed', 'failed'])
  status?: string;

  @ApiPropertyOptional({ description: 'Search by name, phone, passport, etc.' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Search term must be at least 3 characters long' })
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;
}
