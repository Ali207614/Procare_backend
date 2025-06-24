import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsPhoneNumber,
  IsOptional,
  IsDateString,
  IsUUID,
  IsArray,
  ArrayUnique,
  MinLength,
  MaxLength,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'Ali', description: 'First name' })
  @IsString({ context: { location: 'first_name' } })
  @MinLength(2, { context: { location: 'first_name' } })
  @MaxLength(30, { context: { location: 'first_name' } })
  first_name: string;

  @ApiProperty({ example: 'Valiyev', description: 'Last name' })
  @IsString({ context: { location: 'last_name' } })
  @MinLength(2, { context: { location: 'last_name' } })
  @MaxLength(30, { context: { location: 'last_name' } })
  last_name: string;

  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', { context: { location: 'phone_number' } })
  phone_number: string;

  @ApiProperty({ example: 'AA1234567', required: false, description: 'Passport series' })
  @IsOptional()
  @IsString({ context: { location: 'passport_series' } })
  @MinLength(5, { context: { location: 'passport_series' } })
  @MaxLength(15, { context: { location: 'passport_series' } })
  passport_series?: string;

  @ApiProperty({ example: '1990-01-01', required: false, description: 'Birth date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { context: { location: 'birth_date' } })
  birth_date?: string;

  @ApiProperty({ example: '2023-10-01', required: false, description: 'Hire date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { context: { location: 'hire_date' } })
  hire_date?: string;

  @ApiProperty({ example: '12345678', required: false, description: 'ID card number' })
  @IsOptional()
  @IsString({ context: { location: 'id_card_number' } })
  @MinLength(5, { context: { location: 'id_card_number' } })
  @MaxLength(15, { context: { location: 'id_card_number' } })
  id_card_number?: string;

  @ApiProperty({ example: 'uz', required: false, description: 'Language code' })
  @IsOptional()
  @IsString({ context: { location: 'language' } })
  @MinLength(2, { context: { location: 'language' } })
  @MaxLength(5, { context: { location: 'language' } })
  language?: string;

  @ApiProperty({ type: [String], required: false, description: 'Role ID array' })
  @IsOptional()
  @IsArray({ context: { location: 'role_ids' } })
  @ArrayUnique({ context: { location: 'role_ids' } })
  @ArrayMaxSize(20, { context: { location: 'role_ids' } }) // ✅ uzunlik cheklovi
  @IsUUID('all', { each: true, context: { location: 'role_ids' } })
  role_ids?: string[];

  @ApiProperty({ type: [String], required: false, description: 'Branch ID array' })
  @IsOptional()
  @IsArray({ context: { location: 'branch_ids' } })
  @ArrayUnique({ context: { location: 'branch_ids' } })
  @ArrayMaxSize(20, { context: { location: 'branch_ids' } }) // ✅ uzunlik cheklovi
  @IsUUID('all', { each: true, context: { location: 'branch_ids' } })
  branch_ids?: string[];

  @ApiProperty({ example: true, description: 'Admin is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
