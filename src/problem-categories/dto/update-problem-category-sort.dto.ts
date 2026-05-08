import { Min, Max, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProblemCategorySortDto {
  @ApiProperty({ example: 1, description: 'Sorting order of the branch' })
  @IsNumber()
  @Min(0)
  @Max(9999)
  sort!: number;
}
