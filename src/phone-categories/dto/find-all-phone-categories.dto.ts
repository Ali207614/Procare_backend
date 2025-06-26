import { IsOptional, IsUUID, IsString, IsInt, Min } from 'class-validator';
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
  search?: string;
}
