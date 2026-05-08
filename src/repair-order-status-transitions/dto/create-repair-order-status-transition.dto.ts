import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, Matches } from 'class-validator';

export class CreateRepairOrderStatusTransitionDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Role ID for role-based transfer permissions. Omit or pass null for legacy defaults.',
  })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'role_id must be a valid UUID',
    context: { location: 'role_id' },
  })
  role_id?: string | null;

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
