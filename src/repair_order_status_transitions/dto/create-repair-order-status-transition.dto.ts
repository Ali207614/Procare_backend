import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class CreateRepairOrderStatusTransitionDto {
  @ApiProperty({ type: [String], description: 'To status IDs' })
  @IsArray({ context: { location: 'to_status_ids' } })
  @ArrayNotEmpty({ context: { location: 'to_status_ids' } })
  @ArrayUnique({ context: { location: 'to_status_ids' } })
  @IsUUID('all', { each: true, context: { location: 'to_status_ids' } })
  to_status_ids!: string[];
}
