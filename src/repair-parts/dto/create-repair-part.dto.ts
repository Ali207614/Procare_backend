import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRepairPartDto {
  @ApiProperty()
  @IsString({ context: { location: 'part_name_uz' } })
  @MaxLength(255, { context: { location: 'part_name_uz' } })
  part_name_uz!: string;

  @ApiProperty()
  @IsString({ context: { location: 'part_name_ru' } })
  @MaxLength(255, { context: { location: 'part_name_ru' } })
  part_name_ru!: string;

  @ApiProperty()
  @IsString({ context: { location: 'part_name_en' } })
  @MaxLength(255, { context: { location: 'part_name_en' } })
  part_name_en!: string;

  @ApiProperty()
  @IsNumber({}, { context: { location: 'part_price' } })
  part_price!: number;

  @ApiProperty()
  @IsNumber({}, { context: { location: 'quantity' } })
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'description_uz' } })
  @MaxLength(1000, { context: { location: 'description_uz' } })
  description_uz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'description_ru' } })
  @MaxLength(1000, { context: { location: 'description_ru' } })
  description_ru?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ context: { location: 'description_en' } })
  @MaxLength(1000, { context: { location: 'description_en' } })
  description_en?: string;
}
