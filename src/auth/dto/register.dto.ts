import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsPhoneNumber, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', {
    context: { location: 'invalid_phone' },
  })
  phone_number!: string;

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
  password!: string;

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
  confirm_password!: string;
}
