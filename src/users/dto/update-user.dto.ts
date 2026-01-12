import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  MinLength,
  MaxLength,
  IsPhoneNumber,
  Matches,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  first_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(15)
  passport_series?: string;

  @IsOptional()
  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', { context: { location: 'phone_number1' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number1?: string;

  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsOptional()
  @IsPhoneNumber('UZ', { context: { location: 'phone_number2' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id_card_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;
}
