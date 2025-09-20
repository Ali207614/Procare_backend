import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsDateString,
  ValidateNested,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UsersFilterDto {
  @ApiProperty({ required: false, description: 'First name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ required: false, description: 'Last name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ required: false, description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone_number1?: string;

  @ApiProperty({ required: false, description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone_number2?: string;

  @ApiProperty({ required: false, description: 'Passport series' })
  @IsOptional()
  @IsString()
  passport_series?: string;

  @ApiProperty({ required: false, description: 'Birth date (ISO format)' })
  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @ApiProperty({ required: false, description: 'ID card number' })
  @IsOptional()
  @IsString()
  id_card_number?: string;

  @ApiProperty({ enum: ['uz', 'ru', 'en'], required: false, description: 'Language' })
  @IsOptional()
  @IsEnum(['uz', 'ru', 'en'])
  language?: 'uz' | 'ru' | 'en';

  @ApiProperty({ required: false, description: 'Telegram chat ID' })
  @IsOptional()
  @IsNumber()
  telegram_chat_id?: number;

  @ApiProperty({ required: false, description: 'Telegram username' })
  @IsOptional()
  @IsString()
  telegram_username?: string;

  @ApiProperty({
    enum: ['telegram_bot', 'employee', 'web', 'app', 'other'],
    required: false,
    description: 'Source',
  })
  @IsOptional()
  @IsEnum(['telegram_bot', 'employee', 'web', 'app', 'other'])
  source?: 'telegram_bot' | 'employee' | 'web' | 'app' | 'other';

  @ApiProperty({ required: false, description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({
    enum: ['Pending', 'Open', 'Deleted', 'Banned'],
    required: false,
    description: 'Status',
  })
  @IsOptional()
  @IsEnum(['Pending', 'Open', 'Deleted', 'Banned'])
  status?: 'Pending' | 'Open' | 'Deleted' | 'Banned';

  @ApiProperty({ required: false, description: 'Created from date (ISO format, >= this date)' })
  @IsOptional()
  @IsDateString()
  created_from?: string;

  @ApiProperty({ required: false, description: 'Created to date (ISO format, <= this date)' })
  @IsOptional()
  @IsDateString()
  created_to?: string;
}

export class AbTestVariantDto {
  @ApiProperty({
    example: 'Variant A',
    description: 'Variant name (just for identification in analytics)',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Template ID for this variant',
  })
  @IsUUID()
  template_id!: string;

  @ApiProperty({ example: 50, description: 'Percentage of users for this variant (0–100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;
}

export class AbTestConfigDto {
  @ApiProperty({ example: true, description: 'Enable or disable A/B test' })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    type: [AbTestVariantDto],
    description: 'Variants with percentages (must sum to 100)',
    example: [
      {
        name: 'Variant A',
        template_id: '550e8400-e29b-41d4-a716-446655440000',
        percentage: 50,
      },
      {
        name: 'Variant B',
        template_id: '660e8400-e29b-41d4-a716-446655440111',
        percentage: 50,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbTestVariantDto)
  variants!: AbTestVariantDto[];
}

export class CreateCampaignDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440999',
    description: 'Default Template ID',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  template_id!: string;

  @ApiProperty({ type: UsersFilterDto, required: false, description: 'Filters for users' })
  @IsOptional()
  @Type(() => UsersFilterDto)
  @ValidateNested()
  filters?: UsersFilterDto;

  @ApiProperty({ enum: ['now', 'schedule'], description: 'Send type' })
  @IsEnum(['now', 'schedule'])
  send_type!: 'now' | 'schedule';

  @ApiProperty({ enum: ['bot'], description: 'Delivery method' })
  @IsEnum(['bot'])
  delivery_method!: 'bot';

  @ApiProperty({
    example: '2025-08-20T10:00:00Z',
    description: 'Scheduled time (if send_type is schedule)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  schedule_at?: string;

  @ApiProperty({ type: AbTestConfigDto, required: false, description: 'A/B test configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AbTestConfigDto)
  ab_test?: AbTestConfigDto;
}
