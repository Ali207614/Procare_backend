import { IsUUID, IsOptional, IsNumber, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ProblemPartDto {
  @ApiPropertyOptional()
  @IsUUID('all')
  id!: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  part_price!: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  quantity!: number;
}

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
  @ValidateNested({ each: true })
  @Type(() => ProblemPartDto)
  parts?: ProblemPartDto[];
}
