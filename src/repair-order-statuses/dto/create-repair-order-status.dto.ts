import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateRepairOrderStatusDto {
  @ApiProperty({ description: 'Status name in Uzbek', example: 'Yangi', required: true })
  @IsString({ message: 'Name (UZ) must be a string', context: { location: 'name_uz' } })
  @MinLength(1, {
    message: 'Name (UZ) must be at least 1 character',
    context: { location: 'name_uz' },
  })
  @MaxLength(100, {
    message: 'Name (UZ) must not exceed 100 characters',
    context: { location: 'name_uz' },
  })
  @Matches(/^[a-zA-Z\s]+$/, {
    message: 'Name (UZ) must contain only letters and spaces',
    context: { location: 'name_uz' },
  })
  name_uz!: string;

  @ApiProperty({ description: 'Status name in Russian', example: 'Новый', required: true })
  @IsString({ message: 'Name (RU) must be a string', context: { location: 'name_ru' } })
  @MinLength(1, {
    message: 'Name (RU) must be at least 1 character',
    context: { location: 'name_ru' },
  })
  @MaxLength(100, {
    message: 'Name (RU) must not exceed 100 characters',
    context: { location: 'name_ru' },
  })
  @Matches(/^[а-яА-Я\s]+$/, {
    message: 'Name (RU) must contain only Cyrillic letters and spaces',
    context: { location: 'name_ru' },
  })
  name_ru!: string;

  @ApiProperty({ description: 'Status name in English', example: 'New', required: true })
  @IsString({ message: 'Name (EN) must be a string', context: { location: 'name_en' } })
  @MinLength(1, {
    message: 'Name (EN) must be at least 1 character',
    context: { location: 'name_en' },
  })
  @MaxLength(100, {
    message: 'Name (EN) must not exceed 100 characters',
    context: { location: 'name_en' },
  })
  @Matches(/^[a-zA-Z\s]+$/, {
    message: 'Name (EN) must contain only letters and spaces',
    context: { location: 'name_en' },
  })
  name_en!: string;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Invalid branch ID', context: { location: 'branch_id' } })
  branch_id?: string;

  @ApiPropertyOptional({ description: 'Whether the status is active', example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean', context: { location: 'is_active' } })
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Whether users can view the status', example: true })
  @IsOptional()
  @IsBoolean({ message: 'can_user_view must be a boolean', context: { location: 'can_user_view' } })
  can_user_view?: boolean;
}

