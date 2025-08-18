import { IsOptional, IsString, IsNumberString, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllUsersDto {
  @ApiPropertyOptional({ description: 'Search by name, phone, passport, etc.' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Offset (for pagination)', example: 0 })
  @IsOptional()
  @IsNumberString()
  offset?: string;

  @ApiPropertyOptional({ description: 'Limit (for pagination)', example: 20 })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
