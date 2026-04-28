import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class OpenRepairOrderApplicationDto {
  @ApiProperty({
    description:
      'Customer full name from the public application form. The backend trims the value, collapses repeated whitespace, stores the full value on the repair order, and uses the first word as first_name plus the remaining words as last_name for the linked customer.',
    example: 'Asilbek Azimov',
    minLength: 1,
    maxLength: 200,
  })
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  @MaxLength(200, { message: 'Name must not exceed 200 characters' })
  name!: string;

  @ApiProperty({
    description:
      'Uzbekistan phone number. Recommended format is +998901234567. The backend also accepts 998901234567, 901234567, 0901234567, 8901234567, and formatted values such as +998 (90) 123-45-67. The stored/returned value is normalized to E.164.',
    example: '+998901234567',
    minLength: 1,
    maxLength: 30,
  })
  @IsString({ message: 'Phone number must be a string' })
  @MinLength(1, { message: 'Phone number must not be empty' })
  @MaxLength(30, { message: 'Phone number must not exceed 30 characters' })
  phone_number!: string;

  @ApiProperty({
    description:
      'Either an existing active leaf phone category UUID or custom device/model text. If a UUID is provided, it must belong to an active Open category without children. If free text is provided, phone_category_id is left empty and the text is appended to the repair order description.',
    example: 'iPhone 13 Pro',
    minLength: 1,
    maxLength: 200,
  })
  @IsString({ message: 'Phone category must be a string' })
  @MinLength(1, { message: 'Phone category must not be empty' })
  @MaxLength(200, { message: 'Phone category must not exceed 200 characters' })
  phone_category!: string;

  @ApiProperty({
    description:
      'Customer problem description. The field is required and must be a string. Empty string is accepted; it is stored as null unless a custom phone_category line is appended by the backend.',
    example: 'Screen is broken and the battery drains quickly.',
    maxLength: 10000,
  })
  @IsString({ message: 'Description must be a string' })
  @MaxLength(10000, { message: 'Description must not exceed 10000 characters' })
  description!: string;
}
