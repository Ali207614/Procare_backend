import { IsString, IsOptional, IsPhoneNumber, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientInfoDto {
  @ApiPropertyOptional({ description: 'Client first name', example: 'John', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  @ApiPropertyOptional({ description: 'Client last name', example: 'Doe', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Client phone number (international format)',
    example: '+998901234567',
  })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;
}
