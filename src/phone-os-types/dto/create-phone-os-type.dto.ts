import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePhoneOsTypeDto {
  @ApiProperty({ example: 'iOS', description: 'Name in Uzbek' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  name_uz!: string;

  @ApiProperty({ example: 'iOS', description: 'Name in Russian' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  name_ru!: string;

  @ApiProperty({ example: 'iOS', description: 'Name in English' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  name_en!: string;
}
