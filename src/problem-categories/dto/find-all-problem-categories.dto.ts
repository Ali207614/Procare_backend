import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max, MaxLength } from 'class-validator';

export class FindAllProblemCategoriesDto {
  @ApiPropertyOptional({
    description: 'Phone category ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsOptional()
  @IsUUID('all', {
    message: 'Invalid phone category ID',
    context: { location: 'phone_category_id' },
  })
  phone_category_id?: string;

  @ApiPropertyOptional({
    description: 'Parent problem category ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Invalid parent category ID', context: { location: 'parent_id' } })
  parent_id?: string;

  @ApiPropertyOptional({ description: 'Search term for category names', example: 'Ekran' })
  @IsOptional()
  @IsString({ message: 'Search must be a string', context: { location: 'search' } })
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;

  @ApiPropertyOptional({ description: 'Number of records to return', example: 20 })
  @IsOptional()
  @IsInt({ message: 'Limit must be an integer', context: { location: 'limit' } })
  @Min(1, { message: 'Limit must be at least 1', context: { location: 'limit' } })
  @Max(100, { message: 'Limit must not exceed 100', context: { location: 'limit' } })
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @IsOptional()
  @IsInt({ message: 'Offset must be an integer', context: { location: 'offset' } })
  @Min(0, { message: 'Offset cannot be negative', context: { location: 'offset' } })
  offset?: number;
}
