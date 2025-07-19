import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'Main Office', description: 'Name of the branch' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { context: { location: 'branch_name_min' } })
  @MaxLength(100, { context: { location: 'branch_name_max' } })
  name_uz!: string;

  @ApiProperty({ example: 'Main Office', description: 'Name of the branch' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { context: { location: 'branch_name_min' } })
  @MaxLength(100, { context: { location: 'branch_name_max' } })
  name_ru!: string;

  @ApiProperty({ example: 'Main Office', description: 'Name of the branch' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { context: { location: 'branch_name_min' } })
  @MaxLength(100, { context: { location: 'branch_name_max' } })
  name_en!: string;

  @ApiProperty({ example: 'Chilonzor 9 kvartal', description: 'Branch address or location' })
  @IsOptional()
  @IsString()
  @MinLength(1, { context: { location: 'branch_address_min' } })
  @MaxLength(200, { context: { location: 'branch_address_max' } })
  address_uz?: string;

  @ApiProperty({ example: 'Chilonzor 9 kvartal', description: 'Branch address or location' })
  @IsOptional()
  @IsString()
  @MinLength(1, { context: { location: 'branch_address_min' } })
  @MaxLength(200, { context: { location: 'branch_address_max' } })
  address_ru?: string;

  @ApiProperty({ example: 'Chilonzor 9 kvartal', description: 'Branch address or location' })
  @IsOptional()
  @IsString()
  @MinLength(1, { context: { location: 'branch_address_min' } })
  @MaxLength(200, { context: { location: 'branch_address_max' } })
  address_en?: string;

  @ApiProperty({ example: 41.2995, description: 'Latitude coordinate of the branch' })
  @IsOptional()
  @IsNumber()
  @Min(-9000000)
  @Max(90000000)
  lat?: number;

  @ApiProperty({ example: 69.2401, description: 'Longitude coordinate of the branch' })
  @IsOptional()
  @IsNumber()
  @Min(-1800000000)
  @Max(18000000000)
  long?: number;

  @ApiProperty({ example: '+998901234567', description: 'Support phone number' })
  @IsOptional()
  @IsString()
  @MinLength(5, { context: { location: 'support_phone_min' } })
  @MaxLength(20, { context: { location: 'support_phone_max' } })
  support_phone?: string;

  @ApiProperty({ example: '09:00', description: 'Work start time (HH:mm)' })
  @IsOptional()
  @IsString()
  @MinLength(4, { context: { location: 'work_start_time_min' } })
  @MaxLength(5, { context: { location: 'work_start_time_max' } })
  work_start_time?: string;

  @ApiProperty({ example: '18:00', description: 'Work end time (HH:mm)' })
  @IsOptional()
  @IsString()
  @MinLength(4, { context: { location: 'work_end_time_min' } })
  @MaxLength(5, { context: { location: 'work_end_time_max' } })
  work_end_time?: string;

  @ApiProperty({ example: '#ffffff', description: 'Background color in HEX' })
  @IsOptional()
  @IsString()
  @MinLength(4, { context: { location: 'bg_color_min' } })
  @MaxLength(10, { context: { location: 'bg_color_max' } })
  bg_color?: string;

  @ApiProperty({ example: '#000000', description: 'Text color in HEX' })
  @IsOptional()
  @IsString()
  @MinLength(4, { context: { location: 'color_min' } })
  @MaxLength(10, { context: { location: 'color_max' } })
  color?: string;

  @ApiProperty({ example: true, description: 'Whether the branch is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ example: true, description: 'Can user view' })
  @IsOptional()
  @IsBoolean()
  can_user_view?: boolean;
}
