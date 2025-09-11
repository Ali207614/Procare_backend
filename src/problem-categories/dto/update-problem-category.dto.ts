import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProblemCategoryDto {
  @ApiPropertyOptional({ description: 'Problem name in Uzbek', example: 'Ekran sinishi' })
  @IsOptional()
  @IsString({ message: 'Name (UZ) must be a string', context: { location: 'name_uz' } })
  @MinLength(1, {
    message: 'Name (UZ) must be at least 1 character',
    context: { location: 'name_uz' },
  })
  @MaxLength(100, {
    message: 'Name (UZ) must not exceed 100 characters',
    context: { location: 'name_uz' },
  })
  name_uz?: string;

  @ApiPropertyOptional({ description: 'Problem name in Russian', example: 'Поломка экрана' })
  @IsOptional()
  @IsString({ message: 'Name (RU) must be a string', context: { location: 'name_ru' } })
  @MinLength(1, {
    message: 'Name (RU) must be at least 1 character',
    context: { location: 'name_ru' },
  })
  @MaxLength(100, {
    message: 'Name (RU) must not exceed 100 characters',
    context: { location: 'name_ru' },
  })
  name_ru?: string;

  @ApiPropertyOptional({ description: 'Problem name in English', example: 'Screen damage' })
  @IsOptional()
  @IsString({ message: 'Name (EN) must be a string', context: { location: 'name_en' } })
  @MinLength(1, {
    message: 'Name (EN) must be at least 1 character',
    context: { location: 'name_en' },
  })
  @MaxLength(100, {
    message: 'Name (EN) must not exceed 100 characters',
    context: { location: 'name_en' },
  })
  name_en?: string;

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

  @ApiProperty({ example: true, description: 'Whether the category is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
