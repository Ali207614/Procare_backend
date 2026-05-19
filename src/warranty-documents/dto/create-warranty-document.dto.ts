import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWarrantyDocumentDto {
  @ApiProperty({
    example: 'Ushbu kafolat hujjati qoidalari...',
    description: 'Content in Uzbek',
  })
  @IsString()
  @IsNotEmpty()
  content_uz!: string;

  @ApiProperty({
    example: 'Настоящие правила гарантийного документа...',
    description: 'Content in Russian',
    required: false,
  })
  @IsString()
  @IsOptional()
  content_ru?: string;

  @ApiProperty({
    example: 'These warranty document rules...',
    description: 'Content in English',
    required: false,
  })
  @IsString()
  @IsOptional()
  content_en?: string;
}
