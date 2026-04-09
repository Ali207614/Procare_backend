import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class FindAllRepairOrderRejectCausesDto {
  @ApiPropertyOptional({
    example: 'price',
    description: 'Case-insensitive search by reject cause name',
  })
  @IsOptional()
  @IsString({ context: { location: 'search' } })
  @MaxLength(100, { context: { location: 'search' } })
  search?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter reject causes by active state',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ context: { location: 'is_active' } })
  is_active?: boolean;

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
