import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllRecipientsDto {
  @ApiPropertyOptional({ description: 'Search by user name, phone, passport, etc.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: [
      'pending',
      'sent',
      'delivered',
      'read',
      'failed',
      'blocked',
      'unsubscribed',
      'success', // ✅ yangi alias
      'error', // ✅ yangi alias
    ],
    description: 'Filter by recipient status (or use "success"/"error" group filters)',
  })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Sort by column (created_at, sent_at, delivered_at, read_at)',
  })
  @IsOptional()
  @IsEnum(['created_at', 'sent_at', 'delivered_at', 'read_at', 'updated_at'])
  sort_by?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Sort order' })
  @IsOptional()
  sort_order?: 'asc' | 'desc';

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit = 20;
}
