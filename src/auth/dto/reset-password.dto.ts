import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '+998901234567' })
  @IsPhoneNumber('UZ', { context: { location: 'invalid_phone' } })
  phone_number!: string;

  @ApiProperty({ example: '123456' })
  @IsString({ context: { location: 'invalid_reset_code' } })
  @MinLength(1, {
    context: { location: 'invalid_code_length_min' },
  })
  @MaxLength(20, {
    context: { location: 'invalid_code_length_max' },
  })
  code!: string;

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
