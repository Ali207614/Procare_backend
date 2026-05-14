import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ToArray } from 'src/common/decorators/to-array.decorator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RepairOrderAnalyticsQueryDto {
  @ApiProperty({
    description:
      'Analytics range start. Date-only values are interpreted as the start of that local day.',
    example: '2026-05-14',
  })
  @IsString()
  start_time!: string;

  @ApiProperty({
    description:
      'Analytics range end. Date-only values are interpreted inclusively by day, then converted to an exclusive next-day boundary internally.',
    example: '2026-05-31',
  })
  @IsString()
  end_time!: string;

  @ApiPropertyOptional({
    description:
      'Branch IDs. If omitted, Super Admin/view_all sees all open branches; other admins see only viewable branches.',
    isArray: true,
    example: ['c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb'],
  })
  @IsOptional()
  @ToArray()
  @IsArray()
  @ArrayUnique()
  @Matches(UUID_REGEX, {
    each: true,
    message: 'Each value in branch_ids must be a valid UUID',
  })
  branch_ids?: string[];

  @ApiPropertyOptional({
    description:
      'Status IDs to render as dynamic table columns. This affects shown columns, not the Leadlar total.',
    isArray: true,
    example: ['c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb'],
  })
  @IsOptional()
  @ToArray()
  @IsArray()
  @ArrayUnique()
  @Matches(UUID_REGEX, {
    each: true,
    message: 'Each value in status_column_ids must be a valid UUID',
  })
  status_column_ids?: string[];

  @ApiPropertyOptional({
    description: 'Which repair-order time field should be used for the period filter.',
    enum: ['created_at', 'updated_at'],
    default: 'created_at',
  })
  @IsOptional()
  @IsIn(['created_at', 'updated_at'])
  date_field: 'created_at' | 'updated_at' = 'created_at';

  @ApiPropertyOptional({
    description:
      'Only used when date_field=updated_at. status_transitions counts status changes from history; all_updates counts any repair-order update.',
    enum: ['status_transitions', 'all_updates'],
    default: 'status_transitions',
  })
  @IsOptional()
  @IsIn(['status_transitions', 'all_updates'])
  updated_scope: 'status_transitions' | 'all_updates' = 'status_transitions';

  @ApiPropertyOptional({
    description:
      'Only for reject-cause analytics. When true, includes repair orders without a reject cause.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  include_empty_reject_cause = false;
}
