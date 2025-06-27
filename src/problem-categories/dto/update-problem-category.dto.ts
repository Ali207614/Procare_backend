import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsUUID,
  IsBoolean,
  IsEnum,
} from 'class-validator';

export class UpdateProblemCategoryDto {
  @ApiPropertyOptional({ example: 'Yangi oyna', description: 'Problem name in Uzbek' })
  @IsOptional()
  @IsString({ context: { location: 'name_uz' } })
  @MinLength(1, { context: { location: 'name_uz' } })
  @MaxLength(100, { context: { location: 'name_uz' } })
  name_uz?: string;

  @ApiPropertyOptional({ example: 'Новое стекло', description: 'Problem name in Russian' })
  @IsOptional()
  @IsString({ context: { location: 'name_ru' } })
  @MinLength(1, { context: { location: 'name_ru' } })
  @MaxLength(100, { context: { location: 'name_ru' } })
  name_ru?: string;

  @ApiPropertyOptional({ example: 'New Glass', description: 'Problem name in English' })
  @IsOptional()
  @IsString({ context: { location: 'name_en' } })
  @MinLength(1, { context: { location: 'name_en' } })
  @MaxLength(100, { context: { location: 'name_en' } })
  name_en?: string;

  @ApiPropertyOptional({
    example: 'b1c9f670-1234-4def-9876-1122aabbccdd',
    description: 'Parent problem category ID',
  })
  @IsOptional()
  @IsUUID('4', { context: { location: 'parent_id' } })
  parent_id?: string;

  @ApiPropertyOptional({
    example: 120000,
    description: 'Updated price for the problem fix',
  })
  @IsOptional()
  @IsNumber({}, { context: { location: 'price' } })
  @Min(0, { context: { location: 'price' } })
  @Max(1e16, { context: { location: 'price' } })
  price?: number;

  @ApiPropertyOptional({
    example: 40,
    description: 'Updated estimated time in minutes',
  })
  @IsOptional()
  @IsNumber({}, { context: { location: 'estimated_minutes' } })
  @Min(1, { context: { location: 'estimated_minutes' } })
  @Max(1440, { context: { location: 'estimated_minutes' } }) // 1 day max
  estimated_minutes?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether this category is active or not',
  })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_active' } })
  is_active?: boolean;

  @ApiPropertyOptional({
    example: 'Open',
    enum: ['Open', 'Deleted'],
    description: 'Current status of the problem category',
  })
  @IsOptional()
  @IsEnum(['Open', 'Deleted'], { context: { location: 'status' } })
  status?: 'Open' | 'Deleted';

  @ApiPropertyOptional({
    example: 'c2d3e4f5-6789-4abc-bcde-1234567890aa',
    description: 'Phone category ID (only used for root-level problems)',
  })
  @IsOptional()
  @IsUUID('4', { context: { location: 'phone_category_id' } })
  phone_category_id?: string;
}
