import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  Matches,
  MinLength,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRepairOrderStatusDto {
  @ApiProperty({ description: 'Status name in Uzbek', example: 'Yangi' })
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

  @ApiProperty({ description: 'Status name in Russian', example: 'Новый' })
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

  @ApiProperty({ description: 'Status name in English', example: 'New' })
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

  @ApiProperty({ description: 'Background color in HEX format', example: '#F5F5F5' })
  @IsString({ message: 'bg_color must be a string', context: { location: 'bg_color' } })
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'bg_color must be a valid hex color code',
    context: { location: 'bg_color' },
  })
  bg_color!: string;

  @ApiProperty({ description: 'Text color in HEX format', example: '#000000' })
  @IsString({ message: 'color must be a string', context: { location: 'color' } })
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color code',
    context: { location: 'color' },
  })
  color!: string;

  @ApiPropertyOptional({ description: 'Display sort order', example: 1 })
  @IsOptional()
  @IsInt({ message: 'sort must be an integer', context: { location: 'sort' } })
  @Min(1, { message: 'sort must be at least 1', context: { location: 'sort' } })
  sort?: number;

  @ApiPropertyOptional({ description: 'Whether users can see this status', example: true })
  @IsOptional()
  @IsBoolean({ message: 'can_user_view must be a boolean', context: { location: 'can_user_view' } })
  can_user_view?: boolean;

  @ApiPropertyOptional({ description: 'Whether this status is active', example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean', context: { location: 'is_active' } })
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Whether payments can be added in this status',
    example: false,
  })
  @IsOptional()
  @IsBoolean({
    message: 'can_add_payment must be a boolean',
    context: { location: 'can_add_payment' },
  })
  can_add_payment?: boolean;

  @ApiProperty({ description: 'Branch ID', example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec' })
  @IsUUID('all', { message: 'Invalid branch ID', context: { location: 'branch_id' } })
  branch_id!: string;
}
