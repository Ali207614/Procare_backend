import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiProperty({ example: 'Ushbu ommaviy ofera qoidalari...', description: 'Content in Uzbek' })
  @IsString()
  @IsNotEmpty()
  content_uz!: string;

  @ApiProperty({
    example: 'Настоящие правила...',
    description: 'Content in Russian',
    required: false,
  })
  @IsString()
  @IsOptional()
  content_ru?: string;

  @ApiProperty({
    example: 'These public offer rules...',
    description: 'Content in English',
    required: false,
  })
  @IsString()
  @IsOptional()
  content_en?: string;
}
