import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsPhoneNumber, Matches } from 'class-validator';

export class VerifyForgotPasswordOtpDto {
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', {
    message: 'phone_number must be a valid phone number',
    context: { location: 'invalid_phone' },
  })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number!: string;

  @ApiProperty({ example: '123456', description: 'Code' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Invalid code format', context: { location: 'invalid_code' } })
  code!: string;
}
