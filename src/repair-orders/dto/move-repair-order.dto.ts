import { IsNumber, IsString, Max, Min, IsOptional } from 'class-validator';

export class MoveRepairOrderDto {
  @IsString({ context: { location: 'status_id' } })
  status_id!: string;

  @IsNumber({}, { context: { location: 'sort' } })
  @Min(0)
  @Max(9999)
  @IsOptional()
  sort?: number;
}
