import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, MinLength, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsString({ context: { location: 'card_code' } })
  @MinLength(1, { context: { location: 'card_code' } })
  @MaxLength(30, { context: { location: 'card_cod' } })
  sap_card_code: string;
}
