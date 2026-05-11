import { ApiProperty } from '@nestjs/swagger';
import { BreadcrumbItem } from 'src/common/types/breadcrumb.interface';

export class BreadcrumbItemDto implements BreadcrumbItem {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'iPhone' })
  name_uz!: string;

  @ApiProperty({ example: 'iPhone' })
  name_ru!: string;

  @ApiProperty({ example: 'iPhone' })
  name_en!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', nullable: true })
  parent_id!: string | null;

  @ApiProperty({ example: 1 })
  sort!: number;
}

export class ProblemCategoryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Ekran almashtirish' })
  name_uz!: string;

  @ApiProperty({ example: 'Замена экрана' })
  name_ru!: string;

  @ApiProperty({ example: 'Screen replacement' })
  name_en!: string;

  @ApiProperty({ example: null, nullable: true })
  parent_id!: string | null;

  @ApiProperty({ example: '100000.00' })
  price!: string;

  @ApiProperty({ example: 60 })
  estimated_minutes!: number;

  @ApiProperty({ example: 1 })
  sort!: number;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'] })
  status!: 'Open' | 'Deleted';

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', nullable: true })
  created_by!: string | null;

  @ApiProperty({ example: '2024-05-11T10:00:00Z' })
  created_at!: string;

  @ApiProperty({ example: '2024-05-11T10:00:00Z' })
  updated_at!: string;
}

export class RepairPartPartialResponseDto {
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
}

export class ProblemCategoryWithMetaResponseDto extends ProblemCategoryResponseDto {
  @ApiProperty({ example: false })
  has_children!: boolean;

  @ApiProperty({ type: [BreadcrumbItemDto] })
  breadcrumb!: BreadcrumbItemDto[];

  @ApiProperty({ type: [RepairPartPartialResponseDto], required: false })
  assigned_parts?: RepairPartPartialResponseDto[];
}

export class ProblemCategoryPaginationResponseDto {
  @ApiProperty({ type: [ProblemCategoryWithMetaResponseDto] })
  rows!: ProblemCategoryWithMetaResponseDto[];

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Success' })
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  message!: string;

  @ApiProperty({ example: 'BadRequestException' })
  error!: string;

  @ApiProperty({ example: 'name_uz', nullable: true })
  location!: string | null;

  @ApiProperty({ example: '2024-05-11T10:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/problem-categories' })
  path!: string;
}
