import {
  IsUUID,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ProblemDto {
  @ApiPropertyOptional()
  @IsUUID('all', { context: { location: 'problem_category_id' } })
  problem_category_id: string;

  @ApiPropertyOptional()
  @IsNumber({}, { context: { location: 'price' } })
  price: number;

  @ApiPropertyOptional()
  @IsNumber({}, { context: { location: 'estimated_minutes' } })
  estimated_minutes: number;
}

export class UpdateRepairOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { context: { location: 'user_id' } })
  user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { context: { location: 'status_id' } })
  status_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { context: { location: 'phone_category_id' } })
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
