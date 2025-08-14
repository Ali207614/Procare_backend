import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class UpdatePhoneCategoryDto {
  @ApiProperty({ example: 'iPhone', description: 'Category name in Uzbek' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { context: { location: 'phone_category_name_max' } })
  name_uz?: string;

  @ApiProperty({ example: 'Айфон', description: 'Category name in Russian' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { context: { location: 'phone_category_name_max' } })
  name_ru?: string;

  @ApiProperty({ example: 'iPhone', description: 'Category name in English' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { context: { location: 'phone_category_name_max' } })
  name_en?: string;

  @ApiProperty({ example: '#iphoneSticker', description: 'Telegram sticker for the bot display' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  telegram_sticker?: string;

  @ApiProperty({ example: true, description: 'Whether the category is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
