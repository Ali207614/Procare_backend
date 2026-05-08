import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class RemoveAdminsDto {
  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
    description: 'List of admin IDs to remove from the branch',
    required: true,
  })
  @IsArray({ message: 'admin_ids must be an array' })
  @ArrayNotEmpty({ message: 'admin_ids must not be empty' })
  @IsUUID('4', { each: true, message: 'Each admin_id must be a valid UUID' })
  admin_ids!: string[];
}
