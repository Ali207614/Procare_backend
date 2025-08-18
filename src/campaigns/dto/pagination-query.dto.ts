import { IsString, IsOptional, MaxLength, MinLength, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiProperty({ required: false, example: 10, description: 'Number of items per page (1-100)' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : Number(value)))
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must be at most 100' })
  limit: number = 10;

  @ApiProperty({ required: false, example: 0, description: 'Page offset (0 or greater)' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : Number(value)))
  @IsInt({ message: 'Offset must be an integer' })
  @Min(0, { message: 'Offset must be at least 0' })
  offset: number = 0;

  @ApiProperty({
    required: false,
    example: 'main',
    description: 'Search term for filtering (3-100 characters)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Search term must be at least 3 characters long' })
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;
}
