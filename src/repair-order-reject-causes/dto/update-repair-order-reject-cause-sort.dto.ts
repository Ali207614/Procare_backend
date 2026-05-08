import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateRepairOrderRejectCauseSortDto {
  @ApiProperty({
    example: 1,
    description: 'Target sort order among active reject causes',
  })
  @IsInt({ context: { location: 'sort' } })
  @Min(1, { context: { location: 'sort' } })
  @Max(9999, { context: { location: 'sort' } })
  sort!: number;
}
