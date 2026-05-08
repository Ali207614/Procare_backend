import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class FindAllUnfilteredRepairOrdersDto {
  @ApiPropertyOptional({ example: 0, description: 'Pagination offset' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({ example: 20, description: 'Pagination limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;

  @ApiPropertyOptional({
    example: '+998901234567',
    description: 'Search by repair order customer name or phone number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
