import { ApiProperty } from '@nestjs/swagger';
import { REPAIR_ORDER_SOURCES } from 'src/common/types/repair-order.interface';

export class RepairOrderRejectCauseSwaggerDto {
  @ApiProperty({ nullable: true, example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string | null;

  @ApiProperty({ nullable: true, example: 'Client rejected repair' })
  name!: string | null;
}

export class RepairOrderRegionSwaggerDto {
  @ApiProperty({ nullable: true, example: 'f1493a1f-26f6-45c0-8b8b-7f5c4f92f0d7' })
  id!: string | null;

  @ApiProperty({ nullable: true, example: 'Tashkent City' })
  title!: string | null;

  @ApiProperty({ nullable: true, example: 'Central dispatch region' })
  description!: string | null;
}

export class RepairOrderLookupSwaggerDto {
  @ApiProperty({ nullable: true, example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string | null;

  @ApiProperty({ nullable: true, example: 'iPhone 13 Pro Max' })
  name_uz!: string | null;

  @ApiProperty({ nullable: true, example: 'iPhone 13 Pro Max' })
  name_ru!: string | null;

  @ApiProperty({ nullable: true, example: 'iPhone 13 Pro Max' })
  name_en!: string | null;
}

export class RepairOrderTransferBranchSwaggerDto {
  @ApiProperty({ example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string;

  @ApiProperty({ example: "Farg'ona Filial" })
  name_uz!: string;

  @ApiProperty({ example: 'Фергана Филиал' })
  name_ru!: string;

  @ApiProperty({ example: 'Fergana Branch' })
  name_en!: string;
}

export class RepairOrderDetailsBranchSwaggerDto extends RepairOrderLookupSwaggerDto {
  [key: string]: unknown;

  @ApiProperty({
    type: [RepairOrderTransferBranchSwaggerDto],
    description:
      'Active child branches that PATCH /repair-orders/:repair_order_id/transfer-branch accepts for the current admin and that are visible to the admin.',
  })
  transfer_branches!: RepairOrderTransferBranchSwaggerDto[];
}

export class ViewableRepairOrderAssignedAdminSwaggerDto {
  @ApiProperty({ example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string;

  @ApiProperty({ nullable: true, example: 'Alisher' })
  first_name!: string | null;

  @ApiProperty({ nullable: true, example: 'Odilov' })
  last_name!: string | null;

  @ApiProperty({ nullable: true, example: '+998901234567' })
  phone_number!: string | null;

  @ApiProperty({ example: '2026-03-24T09:00:00.000Z' })
  created_at!: string;
}

export class ViewableRepairOrderListItemSwaggerDto {
  @ApiProperty({ example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string;

  @ApiProperty({ example: 12901 })
  number_id!: number;

  @ApiProperty({ example: 'a9bf2d77-2f13-4b8e-b8cb-7d5f2c82f111' })
  status_id!: string;

  @ApiProperty({ nullable: true, example: 'Alisher Odilov' })
  name!: string | null;

  @ApiProperty({ nullable: true, example: '+998900000612' })
  phone_number!: string | null;

  @ApiProperty({
    nullable: true,
    example: '2026-04-16 10:00',
    description: 'Agreed date in YYYY-MM-DD HH:mm format',
  })
  agreed_date!: string | null;

  @ApiProperty({ enum: ['Self', 'Pickup'] })
  pickup_method!: 'Self' | 'Pickup';

  @ApiProperty({ enum: ['Self', 'Delivery'] })
  delivery_method!: 'Self' | 'Delivery';

  @ApiProperty({ type: RepairOrderRejectCauseSwaggerDto })
  reject_cause!: RepairOrderRejectCauseSwaggerDto;

  @ApiProperty({ nullable: true, enum: REPAIR_ORDER_SOURCES, example: 'Telegram' })
  source!: string | null;

  @ApiProperty({ example: 12 })
  call_count!: number;

  @ApiProperty({ example: 2 })
  missed_call_count!: number;

  @ApiProperty({ example: 28 })
  comments_count!: number;

  @ApiProperty({ example: '2026-03-24T09:00:00.000Z' })
  created_at!: string;

  @ApiProperty({ type: RepairOrderLookupSwaggerDto })
  phone_category!: RepairOrderLookupSwaggerDto;

  @ApiProperty({ type: RepairOrderLookupSwaggerDto })
  repair_order_status!: RepairOrderLookupSwaggerDto;

  @ApiProperty({ type: RepairOrderLookupSwaggerDto })
  branch!: RepairOrderLookupSwaggerDto;

  @ApiProperty({ type: [ViewableRepairOrderAssignedAdminSwaggerDto] })
  assigned_admins!: ViewableRepairOrderAssignedAdminSwaggerDto[];

  @ApiProperty({
    example: false,
    description:
      'True only when the current view can take a Mother Branch repair order into a child branch.',
  })
  is_mothers!: boolean;
}

export class RepairOrderListItemSwaggerDto {
  @ApiProperty({ example: 'c7a77f42-2f13-4b8e-b8cb-7d5f2c82fbbb' })
  id!: string;

  @ApiProperty({ example: 12345 })
  number_id!: number;

  @ApiProperty({ example: '0.00' })
  total!: string;

  @ApiProperty({ nullable: true, example: '352099001761481' })
  imei!: string | null;

  @ApiProperty({ enum: ['Self', 'Delivery'] })
  delivery_method!: 'Self' | 'Delivery';

  @ApiProperty({ enum: ['Self', 'Pickup'] })
  pickup_method!: 'Self' | 'Pickup';

  @ApiProperty({ example: 1 })
  sort!: number;

  @ApiProperty({ enum: ['Low', 'Medium', 'High', 'Highest'] })
  priority!: 'Low' | 'Medium' | 'High' | 'Highest';

  @ApiProperty({ example: 'a9bf2d77-2f13-4b8e-b8cb-7d5f2c82f111' })
  status_id!: string;

  @ApiProperty({ nullable: true, example: 'John Doe' })
  name!: string | null;

  @ApiProperty({
    nullable: true,
    example: 'Customer asked for a callback before replacing any parts.',
  })
  description!: string | null;

  @ApiProperty({
    nullable: true,
    example: '2026-03-25 10:00',
    description: 'Agreed date in YYYY-MM-DD HH:mm format',
  })
  agreed_date!: string | null;

  @ApiProperty({ type: RepairOrderRejectCauseSwaggerDto })
  reject_cause!: RepairOrderRejectCauseSwaggerDto;

  @ApiProperty({ type: RepairOrderRegionSwaggerDto })
  region!: RepairOrderRegionSwaggerDto;

  @ApiProperty({ nullable: true, example: '+998901234567' })
  phone_number!: string | null;

  @ApiProperty({ nullable: true, enum: REPAIR_ORDER_SOURCES, example: "Sug'urta" })
  source!: string | null;

  @ApiProperty({ example: 0, description: 'Number of calls made to the customer' })
  call_count!: number;

  @ApiProperty({ example: 2 })
  missed_call_count!: number;

  @ApiProperty({ nullable: true, example: '2026-03-27T07:15:00.000Z' })
  deadline_at!: string | null;

  @ApiProperty({ example: '2026-03-24T09:00:00.000Z' })
  created_at!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  user!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  created_by_admin!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  phone_category!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  repair_order_status!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  branch!: Record<string, unknown>;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  assigned_admins!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  initial_problems!: Record<string, unknown>[];

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  final_problems!: Record<string, unknown>[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    deprecated: true,
    description:
      'Deprecated for GET /api/v1/repair-orders/:repair_order_id. Use GET /api/v1/repair-orders/:repair_order_id/comments for paginated comments and audio files.',
  })
  comments!: Record<string, unknown>[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  rental_phone!: Record<string, unknown>;
}

export class RepairOrderDetailsSwaggerDto extends RepairOrderListItemSwaggerDto {
  @ApiProperty({ type: RepairOrderDetailsBranchSwaggerDto })
  branch!: RepairOrderDetailsBranchSwaggerDto;

  @ApiProperty({ type: 'object', additionalProperties: true })
  pickups!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  delivery!: Record<string, unknown>;
}
