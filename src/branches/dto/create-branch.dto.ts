import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'Main Office', description: 'Branch name in Uzbek', required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Name (UZ) must be at least 1 character' })
  @MaxLength(100, { message: 'Name (UZ) must not exceed 100 characters' })
  name_uz!: string;

  @ApiProperty({ example: 'Main Office', description: 'Branch name in Russian', required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Name (RU) must be at least 1 character' })
  @MaxLength(100, { message: 'Name (RU) must not exceed 100 characters' })
  name_ru!: string;

  @ApiProperty({ example: 'Main Office', description: 'Branch name in English', required: true })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Name (EN) must be at least 1 character' })
  @MaxLength(100, { message: 'Name (EN) must not exceed 100 characters' })
  name_en!: string;

  @ApiProperty({
    example: 'Chilonzor 9 kvartal',
    description: 'Branch address in Uzbek',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Address (UZ) must be at least 1 character' })
  @MaxLength(200, { message: 'Address (UZ) must not exceed 200 characters' })
  address_uz?: string;

  @ApiProperty({
    example: 'Chilonzor 9 kvartal',
    description: 'Branch address in Russian',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Address (RU) must be at least 1 character' })
  @MaxLength(200, { message: 'Address (RU) must not exceed 200 characters' })
  address_ru?: string;

  @ApiProperty({
    example: 'Chilonzor 9 kvartal',
    description: 'Branch address in English',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Address (EN) must be at least 1 character' })
  @MaxLength(200, { message: 'Address (EN) must not exceed 200 characters' })
  address_en?: string;

  @ApiProperty({
    example: 41.2995,
    description: 'Latitude coordinate of the branch',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  lat?: number;

  @ApiProperty({
    example: 69.2401,
    description: 'Longitude coordinate of the branch',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  long?: number;

  @ApiProperty({ example: '+998901234567', description: 'Support phone number', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  support_phone?: string;

  @ApiProperty({ example: '09:00', description: 'Work start time (HH:mm)', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Invalid time format (HH:mm)' })
  work_start_time?: string;

  @ApiProperty({ example: '18:00', description: 'Work end time (HH:mm)', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Invalid time format (HH:mm)' })
  work_end_time?: string;

  @ApiProperty({ example: '#ffffff', description: 'Background color in HEX', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Invalid HEX color format' })
  bg_color?: string;

  @ApiProperty({ example: '#000000', description: 'Text color in HEX', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Invalid HEX color format' })
  color?: string;

  @ApiProperty({ example: true, description: 'Whether the branch is active', required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ example: true, description: 'Whether users can view the branch', required: false })
  @IsOptional()
  @IsBoolean()
  can_user_view?: boolean;
}
