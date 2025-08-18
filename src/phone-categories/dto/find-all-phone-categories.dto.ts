import { IsOptional, IsUUID, IsString, IsInt, Min, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class FindAllPhoneCategoriesDto {
  @IsOptional()
  @IsUUID()
  phone_os_type_id?: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Search term must be at least 3 characters long' })
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;
}
