import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class FindAllPermissionsDto {
  @ApiPropertyOptional({ example: 0, description: 'Offset for pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ example: 10, description: 'Limit for pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'user.create', description: 'Search by name or description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: ['name', 'description', 'created_at'],
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsEnum(['name', 'description', 'created_at'], {
    message: 'sort_by must be one of: name, description, created_at',
  })
  sort_by?: string = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Sort order' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_order?: 'asc' | 'desc' = 'desc';
}
