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
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { REPAIR_ORDER_SOURCES, RepairOrderSource } from 'src/common/types/repair-order.interface';
import { formatUzPhoneToE164 } from 'src/common/utils/phone.util';

const normalizeUzbekPhone = ({ value }: TransformFnParams): unknown => {
  const input: unknown = value;

  if (input === undefined || input === null) {
    return undefined;
  }

  if (typeof input !== 'string') {
    return input;
  }

  const trimmed = input.trim();
  return trimmed ? formatUzPhoneToE164(trimmed) : undefined;
};

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
    nullable: true,
    description: 'General repair order description or comment',
    example: 'Client asked to preserve data and avoid factory reset unless approved.',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(10000, { message: 'Description must not exceed 10000 characters' })
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Client phone number',
    example: '+998901234567',
  })
  @IsOptional()
  @Transform(normalizeUzbekPhone)
  @IsPhoneNumber('UZ', { context: { location: 'phone_number' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Client phone number alias',
    example: '+998901234567',
  })
  @IsOptional()
  @Transform(normalizeUzbekPhone)
  @IsPhoneNumber('UZ', { context: { location: 'phone' } })
  @Matches(/^\+998[0-9]{9}$/, { message: 'Invalid phone number format' })
  phone?: string;

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
  agreed_date?: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Source of the repair order',
    enum: REPAIR_ORDER_SOURCES,
    example: "Sug'urta",
  })
  @IsOptional()
  @IsEnum(REPAIR_ORDER_SOURCES, { message: 'Invalid source type' })
  source?: RepairOrderSource;
}
