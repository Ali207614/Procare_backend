import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RepairOrderCommentType } from 'src/common/types/repair-order-comment.interface';

export const REPAIR_ORDER_COMMENT_TYPES = ['manual', 'history'] as const;

function toCommentTypes(value: unknown): RepairOrderCommentType[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const rawValues = Array.isArray(value) ? value : [value];

  return rawValues
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean) as RepairOrderCommentType[];
}

export class FindRepairOrderCommentsDto {
  @ApiPropertyOptional({
    description:
      'Filter by one or more comment types. Accepts repeated query params or comma-separated values.',
    enum: REPAIR_ORDER_COMMENT_TYPES,
    isArray: true,
    example: ['manual', 'history'],
  })
  @IsOptional()
  @Transform(({ value }) => toCommentTypes(value))
  @IsArray()
  @IsIn(REPAIR_ORDER_COMMENT_TYPES, { each: true })
  types?: RepairOrderCommentType[];

  @ApiPropertyOptional({
    description: 'Convenience filter for a single comment type.',
    enum: REPAIR_ORDER_COMMENT_TYPES,
    example: 'manual',
  })
  @IsOptional()
  @IsIn(REPAIR_ORDER_COMMENT_TYPES)
  type?: RepairOrderCommentType;

  @ApiPropertyOptional({
    description: 'Pagination offset.',
    default: 0,
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({
    description: 'Pagination limit. Capped at 100 to keep comment loading fast.',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class RepairOrderCommentAdminDto {
  @ApiProperty({ nullable: true, example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string | null;

  @ApiProperty({ nullable: true, example: 'Ali' })
  first_name!: string | null;

  @ApiProperty({ nullable: true, example: 'Valiyev' })
  last_name!: string | null;

  @ApiProperty({ nullable: true, example: '+998901234567' })
  phone_number!: string | null;
}

export class RepairOrderCommentStatusDto {
  @ApiProperty({ nullable: true, example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string | null;

  @ApiProperty({ nullable: true, example: 'Yangi' })
  name_uz!: string | null;

  @ApiProperty({ nullable: true, example: 'Новый' })
  name_ru!: string | null;

  @ApiProperty({ nullable: true, example: 'New' })
  name_en!: string | null;

  @ApiProperty({ nullable: true, example: true })
  can_user_view!: boolean | null;
}

export class RepairOrderCommentItemDto {
  @ApiProperty({ example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string;

  @ApiProperty({ example: 'Customer asked for a callback before replacing the screen.' })
  text!: string;

  @ApiProperty({ enum: ['Open', 'Deleted'], example: 'Open' })
  status!: 'Open' | 'Deleted';

  @ApiProperty({ enum: REPAIR_ORDER_COMMENT_TYPES, example: 'manual' })
  comment_type!: RepairOrderCommentType;

  @ApiProperty({ nullable: true, example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  history_change_id!: string | null;

  @ApiProperty({ example: true })
  is_editable!: boolean;

  @ApiProperty({ example: true })
  is_deletable!: boolean;

  @ApiProperty({ type: RepairOrderCommentAdminDto })
  created_by_admin!: RepairOrderCommentAdminDto;

  @ApiProperty({ type: RepairOrderCommentStatusDto })
  repair_order_status!: RepairOrderCommentStatusDto;

  @ApiProperty({ example: '2026-04-30T08:15:00.000Z' })
  created_at!: string;

  @ApiProperty({ example: '2026-04-30T08:15:00.000Z' })
  updated_at!: string;

  @ApiProperty({ example: '2026-04-30 13:15:00' })
  created_at_local!: string;

  @ApiProperty({ example: '2026-04-30 13:15:00' })
  updated_at_local!: string;
}

export class RepairOrderCommentAudioFileDto {
  @ApiProperty({ example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string;

  @ApiProperty({ description: 'OnlinePBX call/session UUID.', example: '8f6c0e1b7d7f4b8b9d52' })
  uuid!: string;

  @ApiProperty({ nullable: true, example: 'inbound' })
  direction!: string | null;

  @ApiProperty({ nullable: true, example: 'call_end' })
  event!: string | null;

  @ApiProperty({ nullable: true, example: '+998901234567' })
  caller!: string | null;

  @ApiProperty({ nullable: true, example: '123' })
  callee!: string | null;

  @ApiProperty({ nullable: true, example: 95 })
  call_duration!: number | null;

  @ApiProperty({ nullable: true, example: 83 })
  dialog_duration!: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Fresh temporary OnlinePBX recording URL generated from the stored call UUID.',
    example: 'https://api.onlinepbx.ru/recordings/example.mp3',
  })
  download_url!: string | null;

  @ApiProperty({ example: '2026-04-30T08:15:00.000Z' })
  created_at!: string;
}

export class RepairOrderCommentsResponseDto {
  @ApiProperty({ type: [RepairOrderCommentItemDto] })
  comments!: RepairOrderCommentItemDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 'Asia/Tashkent' })
  timezone!: string;

  @ApiProperty({
    type: [RepairOrderCommentAudioFileDto],
    description:
      'All audio files currently linked to this repair order. Recording URLs are refreshed from OnlinePBX before being returned.',
  })
  audio_files!: RepairOrderCommentAudioFileDto[];
}
