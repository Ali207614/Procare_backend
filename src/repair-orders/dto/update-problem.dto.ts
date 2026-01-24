import { IsUUID, IsOptional, IsNumber, Min, IsArray, ArrayUnique } from 'class-validator';

export class UpdateProblemDto {
  @IsOptional()
  @IsUUID()
  problem_category_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  estimated_minutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID({}, { each: true })
  parts?: string[];
}