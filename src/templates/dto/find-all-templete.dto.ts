import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class FindAllTemplatesDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : Number(value)))
  limit: number = 10;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : Number(value)))
  offset: number = 0;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Search term must be at least 3 characters long' })
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;
}
