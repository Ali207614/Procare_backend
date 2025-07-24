import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsPhoneNumber,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength, Matches,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Ali', description: 'First name' })
  @IsString({ context: { location: 'first_name' } })
  @MinLength(2, { context: { location: 'first_name' } })
  @MaxLength(30, { context: { location: 'first_name' } })
  first_name!: string;

  @ApiProperty({ example: 'Valiyev', description: 'Last name' })
  @IsString({ context: { location: 'last_name' } })
  @MinLength(2, { context: { location: 'last_name' } })
  @MaxLength(30, { context: { location: 'last_name' } })
  last_name!: string;

  @ApiProperty({ example: '+998901234567', description: 'Phone number' })
  @IsPhoneNumber('UZ', { context: { location: 'phone_number' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number!: string;

  @ApiProperty({ example: 'AA1234567', required: false })
  @IsOptional()
  @IsString({ context: { location: 'passport_series' } })
  passport_series?: string;

  @ApiProperty({ example: '2000-01-01', required: false })
  @IsOptional()
  @IsDateString({}, { context: { location: 'birth_date' } })
  birth_date?: string;

  @ApiProperty({ example: '12345678', required: false })
  @IsOptional()
  @IsString({ context: { location: 'id_card_number' } })
  id_card_number?: string;

  @ApiProperty({ example: 'uz', required: false })
  @IsOptional()
  @IsString({ context: { location: 'language' } })
  language?: string;

  @IsOptional()
  @IsString({ context: { location: 'card_code' } })
  @MinLength(1, { context: { location: 'card_code' } })
  @MaxLength(30, { context: { location: 'card_cod' } })
  sap_card_code!: string;
}
