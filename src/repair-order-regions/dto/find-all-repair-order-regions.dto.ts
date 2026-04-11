import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class FindAllRepairOrderRegionsDto {
  @ApiPropertyOptional({
    example: 'tashkent',
    description: 'Case-insensitive search by repair order region title',
  })
  @IsOptional()
  @IsString({ context: { location: 'search' } })
  @MaxLength(100, { context: { location: 'search' } })
  search?: string;

  @ApiPropertyOptional({
    example: 20,
    description: 'Maximum number of rows to return',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { location: 'limit' } })
  @Min(1, { context: { location: 'limit' } })
  limit?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Number of rows to skip',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { location: 'offset' } })
  @Min(0, { context: { location: 'offset' } })
  offset?: number;
}
