import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsPhoneNumber, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { RegionEnum } from 'src/common/types/region.enum';

export class RegisterDto {

    @ApiProperty({ example: '+998901234567', description: 'Phone number' })
    @IsPhoneNumber('UZ', {
        context: { location: 'invalid_phone' },
    })
    phone_number: string;

    @ApiProperty({ example: 'John wick', description: 'Username' })
    @IsString({
        context: { location: 'invalid_username' },
    })
    @MinLength(3, {
        context: { location: 'invalid_username_length_min' },
    })
    @MaxLength(20, {
        context: { location: 'invalid_username_length_max' },
    })
    username: string;

    @ApiProperty({ example: '111', description: 'Password' })
    @IsString({
        context: { location: 'invalid_password' },
    })
    @MinLength(4, {
        context: { location: 'invalid_password_length_min' },
    })
    @MaxLength(20, {
        context: { location: 'invalid_password_length_max' },
    })
    password: string;


    @ApiPropertyOptional({
        example: 'toshkent',
        enum: RegionEnum,
        description: 'User region (optional)'
    })
    @IsOptional()
    @IsEnum(RegionEnum, {
        message: 'Region is invalid',
        context: { location: 'invalid_region' },
    })
    region?: RegionEnum;

}
