import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyDto {
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', {
    message: 'phone_number must be a valid phone number',
    context: { location: 'invalid_phone' },
  })
  phone_number: string;

  @ApiProperty({ example: '789034', description: 'Code' })
  @IsString({
    message: 'code must be a string',
    context: { location: 'invalid_code' },
  })
  @MinLength(1, {
    context: { location: 'invalid_code_length_min' },
  })
  @MaxLength(20, {
    context: { location: 'invalid_code_length_max' },
  })
  code: string;
}
