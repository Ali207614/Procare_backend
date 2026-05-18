import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRepairPartDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'part_name_uz' } })
  @MaxLength(255, { context: { location: 'part_name_uz' } })
  part_name_uz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'part_name_ru' } })
  @MaxLength(255, { context: { location: 'part_name_ru' } })
  part_name_ru?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'part_name_en' } })
  @MaxLength(255, { context: { location: 'part_name_en' } })
  part_name_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { context: { location: 'part_price' } })
  part_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { context: { location: 'quantity' } })
  quantity?: number;

  @ApiPropertyOptional({ example: 90, description: 'Warranty period value' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { location: 'warranty_period' } })
  @Min(0, { context: { location: 'warranty_period' } })
  warranty_period?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'description_uz' } })
  @MaxLength(1000, { context: { location: 'description_uz' } })
  description_uz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'description_ru' } })
  @MaxLength(1000, { context: { location: 'description_ru' } })
  description_ru?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'description_en' } })
  @MaxLength(1000, { context: { location: 'description_en' } })
  description_en?: string;
}
