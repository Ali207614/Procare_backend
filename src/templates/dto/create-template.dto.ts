import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template title (min 3, max 100 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(100, { message: 'Title must be at most 100 characters long' })
  title!: string;

  @ApiProperty({ enum: ['uz', 'ru', 'en'], description: 'Language' })
  @IsEnum(['uz', 'ru', 'en'])
  language!: string;

  @ApiProperty({ description: 'Body text (min 10, max 2000 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Body must be at least 10 characters long' })
  @MaxLength(2000, { message: 'Body must be at most 2000 characters long' })
  body!: string;

  @ApiProperty({ description: 'Variables (JSON)', required: false })
  @IsOptional()
  variables?: any;

  @ApiProperty({ enum: ['draft', 'active', 'archived'], description: 'Status' })
  @IsEnum(['draft', 'active', 'archived'])
  status!: string;

  @ApiProperty({ description: 'Created by (Admin UUID)' })
  @IsString()
  @IsNotEmpty()
  created_by!: string;
}
