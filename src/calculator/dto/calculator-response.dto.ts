import { ApiProperty } from '@nestjs/swagger';

export class OsTypeResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'iOS' })
  name_uz!: string;

  @ApiProperty({ example: 'iOS' })
  name_ru!: string;

  @ApiProperty({ example: 'iOS' })
  name_en!: string;

  @ApiProperty({ example: 1 })
  sort!: number;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'] })
  status!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  created_at!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updated_at!: string;
}

export class PhoneCategoryResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'iPhone 13' })
  name_uz!: string;

  @ApiProperty({ example: 'iPhone 13' })
  name_ru!: string;

  @ApiProperty({ example: 'iPhone 13' })
  name_en!: string;

  @ApiProperty({ example: 'sticker_url', required: false, nullable: true })
  telegram_sticker?: string | null;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', required: false, nullable: true })
  phone_os_type_id?: string | null;

  @ApiProperty({ example: null, required: false, nullable: true })
  parent_id?: string | null;

  @ApiProperty({ example: 1 })
  sort!: number;

  @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'] })
  status!: string;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  created_at!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updated_at!: string;

  @ApiProperty({ example: false })
  has_children!: boolean;

  @ApiProperty({ example: false })
  has_problems!: boolean;
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

  @ApiProperty({ example: null, required: false, nullable: true })
  parent_id!: string | null;

  @ApiProperty({ example: '100000.00' })
  price!: string;

  @ApiProperty({ example: 60 })
  estimated_minutes!: number;

  @ApiProperty({ example: 1 })
  sort!: number;

  @ApiProperty({ example: '150000.00', description: 'Total cost including required parts' })
  cost!: string;
}
