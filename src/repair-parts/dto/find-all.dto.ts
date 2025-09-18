import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  IsInt,
} from 'class-validator';

export class FindAllPartsDto {
  @ApiPropertyOptional({ example: 10, description: 'How many items to fetch (limit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 0, description: 'Starting index for pagination (offset)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    example: 'battery',
    description: 'Search term (minimum 3 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;

  @ApiPropertyOptional({
    enum: ['Open', 'Deleted'],
    description: 'Filter by part status',
    example: 'Open',
  })
  @IsOptional()
  @IsEnum(['Open', 'Deleted'])
  status?: 'Open' | 'Deleted';

  @ApiPropertyOptional({
    type: [String],
    description: 'List of problem category IDs (UUID format)',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  problem_category_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Exclude by problem category IDs (UUID format)',
    example: ['550e8400-e29b-41d4-a716-446655440111'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  exclude_problem_category_ids?: string[];
}
