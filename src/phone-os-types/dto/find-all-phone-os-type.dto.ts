import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FindAllPhoneOsTypeDto {
  @ApiPropertyOptional({ example: 0, description: 'Offset for pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { location: 'offset' } })
  @Min(0, { context: { location: 'offset_min' } })
  offset?: number;

  @ApiPropertyOptional({ example: 20, description: 'Number of items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ context: { location: 'limit' } })
  @Min(1, { context: { location: 'limit_min' } })
  @Max(100, { context: { location: 'limit_max' } })
  limit?: number;
}
