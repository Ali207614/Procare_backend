import { IsOptional, IsEnum, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CourierQueryDto {
  @IsOptional()
  @ApiPropertyOptional()
  search?: string;

  @IsOptional()
  @IsNumberString()
  @ApiPropertyOptional()
  limit?: number;

  @IsOptional()
  @IsNumberString()
  @ApiPropertyOptional()
  offset?: number;
}
