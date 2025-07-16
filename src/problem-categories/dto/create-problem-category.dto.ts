import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsUUID,
  IsBoolean,
  IsEnum,
} from 'class-validator';

export class CreateProblemCategoryDto {
  @ApiProperty({ example: 'Oyna', description: 'Problem name in Uzbek' })
  @IsString({ context: { location: 'name_uz' } })
  @IsNotEmpty({ context: { location: 'name_uz' } })
  @MinLength(1, { context: { location: 'name_uz' } })
  @MaxLength(100, { context: { location: 'name_uz' } })
  name_uz!: string;

  @ApiProperty({ example: 'Стекло', description: 'Problem name in Russian' })
  @IsString({ context: { location: 'name_ru' } })
  @IsNotEmpty({ context: { location: 'name_ru' } })
  @MinLength(1, { context: { location: 'name_ru' } })
  @MaxLength(100, { context: { location: 'name_ru' } })
  name_ru!: string;

  @ApiProperty({ example: 'Glass', description: 'Problem name in English' })
  @IsString({ context: { location: 'name_en' } })
  @IsNotEmpty({ context: { location: 'name_en' } })
  @MinLength(1, { context: { location: 'name_en' } })
  @MaxLength(100, { context: { location: 'name_en' } })
  name_en!: string;

  @ApiPropertyOptional({
    example: '41b7e2a5-1234-4cde-9876-aabbccddeeff',
    description: 'Parent problem category ID. Required if this is a subproblem',
  })
  @IsOptional()
  @IsUUID('4', { context: { location: 'parent_id' } })
  parent_id?: string;

  @ApiProperty({
    example: 110000,
    description: 'Estimated price for this problem fix in UZS',
  })
  @IsOptional()
  @IsNumber({}, { context: { location: 'price' } })
  @Max(1e16, { context: { location: 'price' } })
  price!: number;

  @ApiProperty({
    example: 30,
    description: 'Estimated repair time in minutes',
  })
  @IsOptional()
  @IsNumber({}, { context: { location: 'estimated_minutes' } })
  @Max(1440, { context: { location: 'estimated_minutes' } }) // 1 kun max
  estimated_minutes!: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the category is active or not. Defaults to true.',
  })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_active' } })
  is_active?: boolean;

  @ApiPropertyOptional({
    example: 'Open',
    enum: ['Open', 'Deleted'],
    description: 'Status of the problem category',
  })
  @IsOptional()
  @IsEnum(['Open', 'Deleted'], { context: { location: 'status' } })
  status?: 'Open' | 'Deleted';

  @ApiPropertyOptional({
    example: 'd2f4a941-7c2f-4b7e-85b3-57f679514bbb',
    description: 'Phone category ID (only required when creating a root-level problem)',
  })
  @IsOptional()
  @IsUUID('4', { context: { location: 'phone_category_id' } })
  phone_category_id?: string;
}
