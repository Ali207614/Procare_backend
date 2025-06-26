import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 0, description: 'Qaysi indexdan boshlab olish' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ example: 10, description: 'Nechta element olish' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'main', description: 'Search - nom bo‘yicha qidirish' })
  @IsOptional()
  @IsString()
  search?: string;
}
