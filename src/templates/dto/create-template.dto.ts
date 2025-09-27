import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
  MinLength,
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template title (min 3, max 100 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(100, { message: 'Title must be at most 100 characters long' })
  title!: string;

  @ApiProperty({ enum: ['uz', 'ru', 'en'], description: 'Language' })
  @IsEnum(['uz', 'ru', 'en'])
  language!: string;

  @ApiProperty({ description: 'Body text (min 5, max 1000 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Body must be at least 5 characters long' })
  @MaxLength(1000, { message: 'Body must be at most 1000 characters long' })
  body!: string;

  @ApiPropertyOptional({
    description: 'List of allowed user fields for template',
    type: [String],
    example: ['first_name', 'last_name', 'phone_number1'],
  })
  @IsOptional()
  @IsArray({ message: 'Variables must be an array' })
  @IsIn(
    [
      'first_name',
      'last_name',
      'phone_number1',
      'phone_number2',
      'passport_series',
      'id_card_number',
      'birth_date',
      'telegram_username',
      'phone_verified',
    ],
    { each: true, message: 'Invalid variable key' },
  )
  @Type(() => String)
  variables?: string[];

  @ApiProperty({ enum: ['Draft', 'Open', 'Deleted'], description: 'Status' })
  @IsEnum(['Draft', 'Open', 'Deleted'])
  status!: string;
}
