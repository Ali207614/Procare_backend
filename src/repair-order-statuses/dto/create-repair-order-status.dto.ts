import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';

export class CreateRepairOrderStatusDto {
  @ApiProperty({ example: 'Qabul qilindi', description: 'Name in Uzbek' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { context: { location: 'status_name_min' } })
  @MaxLength(50, { context: { location: 'status_name_max' } })
  name_uz!: string;

  @ApiProperty({ example: 'Принят', description: 'Name in Russian' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { context: { location: 'status_name_min' } })
  @MaxLength(50, { context: { location: 'status_name_max' } })
  name_ru!: string;

  @ApiProperty({ example: 'Received', description: 'Name in English' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { context: { location: 'status_name_min' } })
  @MaxLength(50, { context: { location: 'status_name_max' } })
  name_en!: string;

  @ApiProperty({ example: '#FFFFFF', description: 'Background color' })
  @IsString()
  @IsOptional()
  @MinLength(1, { context: { location: 'status_name_min' } })
  @MaxLength(20, { context: { location: 'status_name_max' } })
  bg_color!: string;

  @ApiProperty({ example: '#000000', description: 'Text color' })
  @IsString()
  @IsOptional()
  @MinLength(1, { context: { location: 'status_name_min' } })
  @MaxLength(20, { context: { location: 'status_name_max' } })
  color!: string;

  @ApiProperty({ example: true, description: 'Visible to user?' })
  @IsOptional()
  @IsBoolean()
  can_user_view?: boolean;

  @ApiProperty({ example: true, description: 'Can add payment' })
  @IsOptional()
  @IsBoolean()
  can_add_payment?: boolean;

  @ApiProperty({ example: 'uuid', description: 'Branch ID' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiProperty({ example: true, description: 'Whether the status is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
