import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '+998901234567' })
  @IsPhoneNumber('UZ', { context: { location: 'invalid_phone' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number!: string;

  @ApiProperty({ example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' })
  @IsString({ context: { location: 'invalid_reset_token' } })
  reset_token!: string;

  @ApiProperty({ example: 'newpass123' })
  @IsString()
  @MinLength(4, { context: { location: 'invalid_password_min' } })
  @MaxLength(20, { context: { location: 'invalid_password_max' } })
  new_password!: string;

  @ApiProperty({ example: 'newpass123' })
  @IsString()
  @MinLength(4, { context: { location: 'invalid_password_min' } })
  @MaxLength(20, { context: { location: 'invalid_password_max' } })
  confirm_new_password!: string;
}
