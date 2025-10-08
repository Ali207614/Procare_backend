import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class FindAllRolesDto {
  @ApiPropertyOptional({
    example: 'admin',
    description: 'Search by role name (case-insensitive)',
  })
  @IsOptional()
  @IsString({ context: { location: 'search' } })
  @MinLength(1, { context: { location: 'search_min' } })
  @MaxLength(100, { context: { location: 'search_min' } })
  search?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active roles (true/false)',
  })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_active' } })
  is_active?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Filter by protected roles (true/false)',
  })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_protected' } })
  is_protected?: boolean;

  @ApiPropertyOptional({
    example: 20,
    description: 'Number of items per page',
  })
  @IsOptional()
  @IsInt({ context: { location: 'limit' } })
  @Min(1, { context: { location: 'limit_min' } })
  @Max(100, { context: { location: 'limit_max' } })
  limit = 20;

  @ApiPropertyOptional({
    example: 0,
    description: 'Offset for pagination (starting index)',
  })
  @IsOptional()
  @IsInt({ context: { location: 'offset' } })
  @Min(0, { context: { location: 'offset_min' } })
  offset = 0;
}
