import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMappingDto {
  @IsOptional()
  @IsUUID()
  problem_category_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}