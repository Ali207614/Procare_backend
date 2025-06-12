import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength,
    MaxLength,
    IsNumber,
    Min,
    Max,
    IsBoolean,
    IsUUID,
} from 'class-validator';

export class CreatePhoneCategoryDto {
    @ApiProperty({ example: 'iPhone', description: 'Category name in Uzbek' })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { context: { location: 'phone_category_name_min' } })
    @MaxLength(100, { context: { location: 'phone_category_name_max' } })
    name_uz: string;

    @ApiProperty({ example: 'Айфон', description: 'Category name in Russian' })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { context: { location: 'phone_category_name_min' } })
    @MaxLength(100, { context: { location: 'phone_category_name_max' } })
    name_ru: string;

    @ApiProperty({ example: 'iPhone', description: 'Category name in English' })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { context: { location: 'phone_category_name_min' } })
    @MaxLength(100, { context: { location: 'phone_category_name_max' } })
    name_en: string;

    @ApiProperty({ example: 'Model', enum: ['OS', 'Brand', 'Model', 'Submodel'], description: 'Category type' })
    @IsEnum(['OS', 'Brand', 'Model', 'Submodel'])
    type: 'OS' | 'Brand' | 'Model' | 'Submodel';

    @ApiProperty({ example: '#iphoneSticker', description: 'Telegram sticker for the bot display' })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    telegram_sticker?: string;

    @ApiProperty({ example: 'uuid', description: 'Parent category ID' })
    @IsOptional()
    @IsUUID()
    @Transform(({ value }) => value?.trim() || null) 
    parent_id?: string;

    @ApiProperty({ example: 'uuid', description: 'Phone os type ID' })
    @IsUUID()
    phone_os_type_id: string;

    @ApiProperty({ example: true, description: 'Whether the category is active' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'], description: 'Status of the category' })
    @IsOptional()
    @IsEnum(['Open', 'Deleted'])
    status?: 'Open' | 'Deleted';
}