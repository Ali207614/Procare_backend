import {
    IsString, IsOptional, IsDateString, MaxLength, MinLength, IsArray, ArrayUnique, IsUUID, IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    birth_date?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    hire_date?: string;

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
