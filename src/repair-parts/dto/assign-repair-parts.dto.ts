import { IsArray, ValidateNested, IsUUID, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class RepairPartAssignmentDto {
  @ApiProperty({ example: 'd4a1e6a9-4f49-4a02-9c0e-b65dded7f15a' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  is_required!: boolean;
}

export class AssignRepairPartsToCategoryDto {
  @ApiProperty({
    description: 'Problem category ID',
    example: 'a9f3294b-8353-4e84-a259-fcb1f34ea58c',
  })
  @IsUUID()
  problem_category_id!: string;

  @ApiProperty({
    type: [RepairPartAssignmentDto],
    description: 'Array of repair part assignments',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepairPartAssignmentDto)
  repair_parts!: RepairPartAssignmentDto[];
}
