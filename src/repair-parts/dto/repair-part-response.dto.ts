import { ApiProperty } from '@nestjs/swagger';

export class RepairPartResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Ekran' })
  part_name_uz!: string;

  @ApiProperty({ example: 'Экран' })
  part_name_ru!: string;

  @ApiProperty({ example: 'Screen' })
  part_name_en!: string;

  @ApiProperty({ example: 100000 })
  part_price!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 90, description: 'Warranty period value' })
  warranty_period!: number;

  @ApiProperty({ example: 'Original screen', required: false, nullable: true })
  description_uz?: string | null;

  @ApiProperty({ example: 'Оригинальный экран', required: false, nullable: true })
  description_ru?: string | null;

  @ApiProperty({ example: 'Original screen', required: false, nullable: true })
  description_en?: string | null;

  @ApiProperty({ example: false, required: false, nullable: true })
  is_required?: boolean | null;

  @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'] })
  status!: 'Open' | 'Deleted';

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', required: false, nullable: true })
  created_by?: string | null;

  @ApiProperty({ example: '2024-05-11T10:00:00Z' })
  created_at!: string;

  @ApiProperty({ example: '2024-05-11T10:00:00Z' })
  updated_at!: string;
}

class RepairPartPaginationMetaDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export class RepairPartPaginationResponseDto {
  @ApiProperty({ type: RepairPartPaginationMetaDto })
  meta!: RepairPartPaginationMetaDto;

  @ApiProperty({ type: [RepairPartResponseDto] })
  data!: RepairPartResponseDto[];
}
