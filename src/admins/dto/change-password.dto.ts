import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ example: '111', description: 'Password' })
    @IsString({
        context: { location: 'invalid_password' },
    })
    @MinLength(1, {
        context: { location: 'invalid_password_length_min' },
    })
    @MaxLength(20, {
        context: { location: 'invalid_password_length_max' },
    })
    current_password: string;

    @ApiProperty({ example: '111', description: 'Password' })
    @IsString({
        context: { location: 'invalid_password' },
    })
    @MinLength(1, {
        context: { location: 'invalid_password_length_min' },
    })
    @MaxLength(20, {
        context: { location: 'invalid_password_length_max' },
    })
    new_password: string;
}
