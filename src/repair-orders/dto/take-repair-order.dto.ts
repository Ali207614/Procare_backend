import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TakeRepairOrderDto {
  @ApiProperty({
    description: 'Exact child branch ID that will take the Mother Branch repair order',
    format: 'uuid',
  })
  @IsUUID()
  branch_id!: string;
}
