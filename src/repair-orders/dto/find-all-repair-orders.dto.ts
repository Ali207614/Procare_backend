import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class FindAllRepairOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Pagination uchun offset (default: 0)',
    example: 0,
  })
  @IsOptional()
  @IsInt({ message: 'offset butun son bo‘lishi kerak' })
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({
    description: 'Pagination uchun limit (default: 20)',
    example: 20,
  })
  @IsOptional()
  @IsInt({ message: 'limit butun son bo‘lishi kerak' })
  @Min(1)
  limit = 20;

  @ApiPropertyOptional({
    description: 'Saralash ustuni (default: sort)',
    enum: ['sort', 'priority', 'created_at', 'updated_at'],
    example: 'priority',
  })
  @IsOptional()
  @IsIn(['sort', 'priority', 'created_at', 'updated_at'], {
    message: 'sort_by faqat sort, priority, created_at yoki updated_at bo‘lishi kerak',
  })
  sort_by: 'sort' | 'priority' | 'created_at' | 'updated_at' = 'sort';

  @ApiPropertyOptional({
    description: 'Saralash yo‘nalishi (default: asc)',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'sort_order faqat asc yoki desc bo‘lishi kerak' })
  sort_order: 'asc' | 'desc' = 'asc';

  @ApiProperty({ description: 'Branch ID', example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  @IsUUID()
  branch_id!: string;
}
