import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { HistoryValueType } from '../types/history.types';

const historyValueTypes: HistoryValueType[] = [
  'null',
  'string',
  'text',
  'uuid',
  'integer',
  'decimal',
  'money',
  'boolean',
  'date',
  'timestamp',
  'enum',
  'phone',
  'email',
  'url',
  'file',
  'reference',
];

export class SearchHistoryValuesDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @MaxLength(500)
  value!: string;

  @ApiPropertyOptional({ enum: historyValueTypes, example: 'phone' })
  @IsOptional()
  @IsIn(historyValueTypes)
  value_type?: HistoryValueType;

  @ApiPropertyOptional({ example: 'repair_orders' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  entity_table?: string;

  @ApiPropertyOptional({ example: 'phone_number' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  field_path?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
