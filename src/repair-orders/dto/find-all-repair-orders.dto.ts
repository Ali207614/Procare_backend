import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  IsArray,
  IsString,
  IsDateString,
} from 'class-validator';

export class FindAllRepairOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Pagination uchun offset (default: 0)',
    example: 0,
  })
  @IsOptional()
  @IsInt({ message: 'offset butun son bolishi kerak' })
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({
    description: 'Pagination uchun limit (default: 20)',
    example: 20,
  })
  @IsOptional()
  @IsInt({ message: 'limit butun son bolishi kerak' })
  @Min(1)
  limit = 20;

  @ApiPropertyOptional({
    description: 'Saralash ustuni (default: sort)',
    enum: ['sort', 'priority', 'created_at', 'updated_at'],
    example: 'priority',
  })
  @IsOptional()
  @IsIn(['sort', 'priority', 'created_at', 'updated_at'], {
    message: 'sort_by faqat sort, priority, created_at yoki updated_at bolishi kerak',
  })
  sort_by: 'sort' | 'priority' | 'created_at' | 'updated_at' = 'sort';

  @ApiPropertyOptional({
    description: 'Saralash yunalishi (default: asc)',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'sort_order faqat asc yoki desc bolishi kerak' })
  sort_order: 'asc' | 'desc' = 'asc';

  @ApiProperty({ description: 'Branch ID', example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  @IsUUID()
  branch_id!: string;

  // Filters
  @ApiPropertyOptional({
    description: 'Qabul qilingan manba boyicha filter',
    enum: ['Organic', 'App', 'Meta', 'Web', 'Bot', 'Other'],
    isArray: true,
    example: ['Organic', 'App'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Organic', 'App', 'Meta', 'Web', 'Bot', 'Other'], { each: true })
  source_types?: string[];

  @ApiPropertyOptional({
    description: 'Muhimlilik darajasi boyicha filter',
    enum: ['Low', 'Medium', 'High', 'Highest'],
    isArray: true,
    example: ['High', 'Highest'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Low', 'Medium', 'High', 'Highest'], { each: true })
  priorities?: string[];

  @ApiPropertyOptional({
    description: 'Mijoz ismi boyicha qidiruv',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({
    description: 'Telefon raqami boyicha qidiruv',
    example: '+998901234567',
  })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Qurilma modeli boyicha qidiruv',
    example: 'iPhone 14',
  })
  @IsOptional()
  @IsString()
  device_model?: string;

  @ApiPropertyOptional({
    description: 'Vazifa raqami boyicha qidiruv',
    example: '12345',
  })
  @IsOptional()
  @IsString()
  order_number?: string;

  @ApiPropertyOptional({
    description: 'Yetkazib berish usuli boyicha filter',
    enum: ['Self', 'Delivery'],
    isArray: true,
    example: ['Self', 'Delivery'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Self', 'Delivery'], { each: true })
  delivery_methods?: string[];

  @ApiPropertyOptional({
    description: 'Olish usuli boyicha filter',
    enum: ['Self', 'Pickup'],
    isArray: true,
    example: ['Self', 'Pickup'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Self', 'Pickup'], { each: true })
  pickup_methods?: string[];

  @ApiPropertyOptional({
    description: 'Tayinlangan hodimlar ID-lari',
    isArray: true,
    example: ['c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assigned_admin_ids?: string[];

  @ApiPropertyOptional({
    description: 'Yaratilgan sana boshlanishi (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Yaratilgan sana tugashi (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}
