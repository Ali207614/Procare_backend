import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, Matches } from 'class-validator';

export class CreateRepairOrderStatusTransitionDto {
  @ApiProperty({ type: [String], description: 'To status IDs' })
  @IsArray({ context: { location: 'to_status_ids' } })
  @ArrayUnique({ context: { location: 'to_status_ids' } })
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    each: true,
    message: 'Each value in to_status_ids must be a UUID or custom status ID',
    context: { location: 'to_status_ids' },
  })
  to_status_ids!: string[];
}
