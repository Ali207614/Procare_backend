import {
  IsUUID,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsNumber,
  Matches,
  IsArray,
  IsString,
  MinLength,
  MaxLength,
  IsPhoneNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RepairOrderSource } from 'src/common/types/repair-order.interface';

class ProblemPartDto {
  @ApiPropertyOptional()
  @IsUUID('all')
  id!: string;

  @ApiPropertyOptional()
  @IsNumber()
  part_price!: number;

  @ApiPropertyOptional()
  @IsNumber()
  quantity!: number;
}

class ProblemDto {
  @ApiPropertyOptional()
  @IsUUID('all', { context: { location: 'problem_category_id' } })
  problem_category_id!: string;

  @ApiPropertyOptional()
  @IsNumber({}, { context: { location: 'price' } })
  price!: number;

  @ApiPropertyOptional()
  @IsNumber({}, { context: { location: 'estimated_minutes' } })
  estimated_minutes!: number;

  @ApiPropertyOptional({ type: [ProblemPartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemPartDto)
  parts?: ProblemPartDto[];
}

export class UpdateRepairOrderDto {
  @ApiPropertyOptional({
    description: 'Client full name',
    example: 'Alisher Rizayev',
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ context: { location: 'name' } })
  @MinLength(1, { context: { location: 'name' } })
  @MaxLength(200, { context: { location: 'name' } })
  name?: string;

  @ApiPropertyOptional({
    description: 'Client phone number',
    example: '+998901234567',
  })
  @IsOptional()
  @IsPhoneNumber('UZ', { context: { location: 'phone_number' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { context: { location: 'user_id' } })
  user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'Invalid status ID',
  })
  status_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'Invalid phone category ID',
  })
  phone_category_id?: string;

  @ApiPropertyOptional({
    description: 'Repair order region ID',
    example: 'f1493a1f-26f6-45c0-8b8b-7f5c4f92f0d7',
  })
  @IsOptional()
  @IsUUID('all', { context: { location: 'region_id' } })
  region_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'IMEI must be a string' })
  @MinLength(15, { message: 'IMEI must be exactly 15 characters' })
  @MaxLength(15, { message: 'IMEI must be exactly 15 characters' })
  imei?: string;

  @ApiPropertyOptional({ enum: ['Low', 'Medium', 'High', 'Highest'] })
  @IsOptional()
  @IsEnum(['Low', 'Medium', 'High', 'Highest'], { context: { location: 'priority' } })
  priority?: 'Low' | 'Medium' | 'High' | 'Highest';

  @ApiPropertyOptional({ type: [ProblemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProblemDto)
  initial_problems?: ProblemDto[];

  @ApiPropertyOptional({ type: [ProblemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProblemDto)
  final_problems?: ProblemDto[];

  @ApiPropertyOptional({
    nullable: true,
    example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb',
    description: 'Reject cause ID',
  })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'Invalid reject cause ID',
  })
  reject_cause_id?: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-03-26 09:00',
    description: 'Agreed date (YYYY-MM-DD HH:mm)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}(:\d{2})?$/, {
    message: 'Agreed date must be in YYYY-MM-DD HH:mm format',
  })
  agreed_date?: string;

  @ApiPropertyOptional({
    description: 'Source of the repair order',
    enum: [
      'Telegram',
      'Meta',
      'Qolda',
      'Boshqa',
      'Kiruvchi qongiroq',
      'Chiquvchi qongiroq',
      'Organic',
    ],
    example: 'Organic',
  })
  @IsOptional()
  @IsEnum(
    ['Telegram', 'Meta', 'Qolda', 'Boshqa', 'Kiruvchi qongiroq', 'Chiquvchi qongiroq', 'Organic'],
    { message: 'Invalid source type' },
  )
  source?: RepairOrderSource;
}
