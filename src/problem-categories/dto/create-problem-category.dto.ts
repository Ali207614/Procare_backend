import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  Matches,
  MinLength,
  MaxLength,
  Min,
  IsInt,
} from 'class-validator';

export class CreateProblemCategoryDto {
  @ApiProperty({ description: 'Problem name in Uzbek', example: 'Ekran sinishi', required: true })
  @IsString({ message: 'Name (UZ) must be a string', context: { location: 'name_uz' } })
  @MinLength(1, {
    message: 'Name (UZ) must be at least 1 character',
    context: { location: 'name_uz' },
  })
  @MaxLength(100, {
    message: 'Name (UZ) must not exceed 100 characters',
    context: { location: 'name_uz' },
  })
  name_uz!: string;

  @ApiProperty({
    description: 'Problem name in Russian',
    example: 'Поломка экрана',
    required: true,
  })
  @IsString({ message: 'Name (RU) must be a string', context: { location: 'name_ru' } })
  @MinLength(1, {
    message: 'Name (RU) must be at least 1 character',
    context: { location: 'name_ru' },
  })
  @MaxLength(100, {
    message: 'Name (RU) must not exceed 100 characters',
    context: { location: 'name_ru' },
  })
  name_ru!: string;

  @ApiProperty({ description: 'Problem name in English', example: 'Screen damage', required: true })
  @IsString({ message: 'Name (EN) must be a string', context: { location: 'name_en' } })
  @MinLength(1, {
    message: 'Name (EN) must be at least 1 character',
    context: { location: 'name_en' },
  })
  @MaxLength(100, {
    message: 'Name (EN) must not exceed 100 characters',
    context: { location: 'name_en' },
  })
  name_en!: string;

  @ApiPropertyOptional({
    description: 'Parent problem category ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Invalid parent category ID', context: { location: 'parent_id' } })
  parent_id?: string;

  @ApiPropertyOptional({
    description: 'Phone category ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsOptional()
  @IsUUID('all', {
    message: 'Invalid phone category ID',
    context: { location: 'phone_category_id' },
  })
  phone_category_id?: string;

  @ApiPropertyOptional({ description: 'Price of the problem', example: 100000 })
  @IsOptional()
  @IsNumber({}, { message: 'Price must be a number', context: { location: 'price' } })
  @Min(0, { message: 'Price cannot be negative', context: { location: 'price' } })
  price?: number;

  @ApiPropertyOptional({ description: 'Estimated minutes for repair', example: 60 })
  @IsOptional()
  @IsInt({
    message: 'Estimated minutes must be an integer',
    context: { location: 'estimated_minutes' },
  })
  @Min(0, {
    message: 'Estimated minutes cannot be negative',
    context: { location: 'estimated_minutes' },
  })
  estimated_minutes?: number;
}
