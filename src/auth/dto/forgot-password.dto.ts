import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', { context: { location: 'invalid_phone' } })
  phone_number!: string;
}
