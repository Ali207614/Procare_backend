import { IsOptional, IsNumberString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourierQueryDto {
  @ApiProperty({ description: 'Branch ID', example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  @IsUUID()
  branch_id!: string;

  @IsOptional()
  @ApiPropertyOptional()
  search?: string;

  @IsOptional()
  @IsNumberString()
  @ApiPropertyOptional()
  limit?: number;

  @IsOptional()
  @IsNumberString()
  @ApiPropertyOptional()
  offset?: number;
}
