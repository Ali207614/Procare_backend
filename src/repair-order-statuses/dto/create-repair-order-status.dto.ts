import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsEnum,
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
    name_uz: string;

    @ApiProperty({ example: 'Принят', description: 'Name in Russian' })
    @IsString()
    @IsNotEmpty()
    name_ru: string;

    @ApiProperty({ example: 'Received', description: 'Name in English' })
    @IsString()
    @IsNotEmpty()
    name_en: string;

    @ApiProperty({ example: '#FFFFFF', description: 'Background color' })
    @IsString()
    @IsNotEmpty()
    bg_color: string;

    @ApiProperty({ example: '#000000', description: 'Text color' })
    @IsString()
    @IsNotEmpty()
    color: string;


    @ApiProperty({ example: true, description: 'Visible to user?' })
    @IsOptional()
    @IsBoolean()
    can_user_view?: boolean;

    @ApiProperty({ example: 'uuid', description: 'Branch ID' })
    @IsOptional()
    @IsUUID()
    branch_id?: string;


    @ApiProperty({ example: true, description: 'Whether the branch is active' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}