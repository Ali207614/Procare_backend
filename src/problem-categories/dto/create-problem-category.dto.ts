import { ApiProperty } from '@nestjs/swagger';
import {
    IsOptional,
    IsString,
    IsNotEmpty,
    MinLength,
    MaxLength,
    IsNumber,
    Min,
    IsUUID,
    IsBoolean,
    IsEnum,
    Max,
} from 'class-validator';

export class CreateProblemCategoryDto {
    @ApiProperty({ example: 'Oyna', description: 'Problem name in Uzbek' })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { context: { location: 'problem_name_min' } })
    @MaxLength(100, { context: { location: 'problem_name_max' } })
    name_uz: string;

    @ApiProperty({ example: 'Стекло', description: 'Problem name in Russian' })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { context: { location: 'problem_name_min' } })
    @MaxLength(100, { context: { location: 'problem_name_max' } })
    name_ru: string;

    @ApiProperty({ example: 'Glass', description: 'Problem name in English' })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { context: { location: 'problem_name_min' } })
    @MaxLength(100, { context: { location: 'problem_name_max' } })
    name_en: string;

    @ApiProperty({ example: 'uuid', description: 'Parent problem category ID' })
    @IsOptional()
    @IsUUID()
    parent_id?: string;

    @ApiProperty({ example: 110000, description: 'Price of the problem fix' })
    @IsNumber()
    @Min(0)
    @Max(10000000000000000000)
    price: number;

    @ApiProperty({ example: 30, description: 'Estimated repair time in minutes' })
    @IsNumber()
    @Min(1)
    @Max(10000000000000000000)
    estimated_minutes: number;

    @ApiProperty({ example: true, description: 'Whether the category is active' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'], description: 'Status of the category' })
    @IsOptional()
    @IsEnum(['Open', 'Deleted'])
    status?: 'Open' | 'Deleted';
}