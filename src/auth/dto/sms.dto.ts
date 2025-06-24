import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsPhoneNumber, IsString } from 'class-validator';

export class SmsDto {
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', {
    context: { location: 'invalid_phone' },
  })
  phone_number: string;

  @ApiProperty({ example: 'uz', description: 'Lanuage' })
  @IsIn(['uz', 'ru'], {
    context: { location: 'invalid_language' },
  })
  language: string;
}
