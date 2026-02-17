import {
  IsUUID,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsNumber,
  Matches,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ProblemPartDto {
  @ApiPropertyOptional()
  @IsUUID('all')
  id!: string;

  @ApiPropertyOptional()
  @IsNumber()
  part_price!: number;

  @ApiPropertyOptional()
  @IsNumber()
  quantity!: number;
}

class ProblemDto {
  @ApiPropertyOptional()
  @IsUUID('all', { context: { location: 'problem_category_id' } })
  problem_category_id!: string;

  @ApiPropertyOptional()
  @IsNumber({}, { context: { location: 'price' } })
  price!: number;

  @ApiPropertyOptional()
  @IsNumber({}, { context: { location: 'estimated_minutes' } })
  estimated_minutes!: number;

  @ApiPropertyOptional({ type: [ProblemPartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemPartDto)
  parts?: ProblemPartDto[];
}

export class UpdateRepairOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { context: { location: 'user_id' } })
  user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'Invalid status ID',
  })
  status_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'Invalid phone category ID',
  })
  phone_category_id?: string;

  @ApiPropertyOptional({ enum: ['Low', 'Medium', 'High', 'Highest'] })
  @IsOptional()
  @IsEnum(['Low', 'Medium', 'High', 'Highest'], { context: { location: 'priority' } })
  priority?: 'Low' | 'Medium' | 'High' | 'Highest';

  @ApiPropertyOptional({ type: [ProblemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProblemDto)
  initial_problems?: ProblemDto[];

  @ApiPropertyOptional({ type: [ProblemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProblemDto)
  final_problems?: ProblemDto[];
}
