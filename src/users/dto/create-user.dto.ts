import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsPhoneNumber,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Ali', description: 'First name' })
  @IsString({ context: { location: 'first_name' } })
  @MinLength(2, { context: { location: 'first_name' } })
  @MaxLength(30, { context: { location: 'first_name' } })
  first_name!: string;

  @ApiProperty({ example: 'Valiyev', description: 'Last name' })
  @IsString({ context: { location: 'last_name' } })
  @MinLength(2, { context: { location: 'last_name' } })
  @MaxLength(30, { context: { location: 'last_name' } })
  last_name!: string;

  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', { context: { location: 'phone_number1' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number1!: string;

  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsOptional()
  @IsPhoneNumber('UZ', { context: { location: 'phone_number2' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number2?: string;

  @ApiProperty({ example: 'AA1234567', required: false })
  @IsOptional()
  @IsString({ context: { location: 'passport_series' } })
  passport_series?: string;

  @ApiProperty({ example: '2000-01-01', required: false })
  @IsOptional()
  @IsDateString({}, { context: { location: 'birth_date' } })
  birth_date?: string;

  @ApiProperty({ example: '12345678', required: false })
  @IsOptional()
  @IsString({ context: { location: 'id_card_number' } })
  id_card_number?: string;

  @ApiProperty({ example: 'uz', required: false })
  @IsOptional()
  @IsString({ context: { location: 'language' } })
  language?: string;

  @ApiProperty({ example: 'C000123', required: false, description: 'SAP card code' })
  @IsOptional()
  @IsString({ context: { location: 'sap_card_code' } })
  @MinLength(1, { context: { location: 'sap_card_code' } })
  @MaxLength(30, { context: { location: 'sap_card_code' } })
  sap_card_code?: string;

  @ApiProperty({ example: 'password123', required: false, description: 'Password' })
  @IsOptional()
  @IsString({ context: { location: 'password' } })
  @MinLength(6, { context: { location: 'password' } })
  password?: string;

  @ApiProperty({ example: 1234567890, required: false, description: 'Telegram chat ID' })
  @IsOptional()
  @IsNumber({}, { context: { location: 'telegram_chat_id' } })
  telegram_chat_id?: number;

  @ApiProperty({ example: 'telegram_user', required: false, description: 'Telegram username' })
  @IsOptional()
  @IsString({ context: { location: 'telegram_username' } })
  telegram_username?: string;

  @ApiProperty({
    enum: ['telegram_bot', 'employee', 'web', 'app', 'other'],
    required: false,
    description: 'Registration source',
  })
  @IsOptional()
  @IsEnum(['telegram_bot', 'employee', 'web', 'app', 'other'], { context: { location: 'source' } })
  source?: string;

  @ApiProperty({ example: true, required: false, description: 'Phone verified status' })
  @IsOptional()
  @IsBoolean({ context: { location: 'phone_verified' } })
  phone_verified?: boolean;

  @ApiProperty({ example: '123456', required: false, description: 'Verification code' })
  @IsOptional()
  @IsString({ context: { location: 'verification_code' } })
  @MinLength(4, { context: { location: 'verification_code' } })
  @MaxLength(6, { context: { location: 'verification_code' } })
  verification_code?: string;

  @ApiProperty({ example: true, required: false, description: 'Active status' })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_active' } })
  is_active?: boolean;

  @ApiProperty({
    enum: ['Pending', 'Open', 'Deleted', 'Banned'],
    required: false,
    description: 'User status',
  })
  @IsOptional()
  @IsEnum(['Pending', 'Open', 'Deleted', 'Banned'], { context: { location: 'status' } })
  status?: string;
}
