import {
  IsString,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
  IsArray,
  ArrayUnique,
  IsUUID,
  IsBoolean,
  IsPhoneNumber,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { WorkDaysDto } from './create-admin.dto';

export class UpdateAdminDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ context: { location: 'first_name' } })
  @MinLength(2, { context: { location: 'first_name' } })
  @MaxLength(30, { context: { location: 'first_name' } })
  first_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ context: { location: 'last_name' } })
  @MinLength(2, { context: { location: 'last_name' } })
  @MaxLength(30, { context: { location: 'last_name' } })
  last_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ context: { location: 'passport_series' } })
  passport_series?: string;

  @IsOptional()
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', { context: { location: 'phone_number' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number?: string;

  @ApiProperty({ example: '123', required: false, description: 'OnlinePBX code' })
  @IsOptional()
  @IsString({ context: { location: 'onlinepbx_code' } })
  onlinepbx_code?: string;

  @ApiProperty({ type: WorkDaysDto, description: 'Work days', required: false })
  @IsOptional()
  @ValidateNested({ context: { location: 'work_days' } })
  @Type(() => WorkDaysDto)
  work_days?: WorkDaysDto;

  @ApiProperty({
    example: '09:00',
    required: false,
    description: 'Work start time in HH:mm format',
  })
  @IsOptional()
  @IsString({ context: { location: 'work_start_time' } })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Time must be in HH:mm format' })
  work_start_time?: string;

  @ApiProperty({
    example: '18:00',
    required: false,
    description: 'Work end time in HH:mm format',
  })
  @IsOptional()
  @IsString({ context: { location: 'work_end_time' } })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Time must be in HH:mm format' })
  work_end_time?: string;

  @ApiProperty({
    example: '1990-01-01T00:00:00Z',
    required: false,
    description: 'Birth date in ISO 8601 format',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString({}, { context: { location: 'birth_date' } })
  birth_date?: string | null;

  @ApiProperty({
    example: '2023-10-01T00:00:00Z',
    required: false,
    description: 'Hire date in ISO 8601 format',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString({}, { context: { location: 'hire_date' } })
  hire_date?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ context: { location: 'id_card_number' } })
  id_card_number?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ context: { location: 'language' } })
  language?: string;

  @ApiProperty({ type: [String], required: false, description: 'Role ID array' })
  @IsOptional()
  @IsArray({ context: { location: 'role_ids' } })
  @ArrayUnique({ context: { location: 'role_ids' } })
  @IsUUID('all', { each: true, context: { location: 'role_ids' } })
  role_ids?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray({ context: { location: 'branch_ids' } })
  @ArrayUnique({ context: { location: 'branch_ids' } })
  @IsUUID('all', { each: true, context: { location: 'branch_ids' } })
  @Type(() => String)
  branch_ids?: string[];

  @ApiProperty({ example: true, description: 'Admin is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
