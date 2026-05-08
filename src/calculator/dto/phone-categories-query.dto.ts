import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PhoneCategoriesQueryDto {
  @ApiPropertyOptional({
    description: 'The UUID of the parent category. Omit to fetch root categories.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({
    description:
      'Case-insensitive search by category name in Uzbek, Russian, or English. Leading and trailing spaces are ignored.',
    example: 'iPhone 15',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;
}
