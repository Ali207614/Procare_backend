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

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  comments!: Record<string, unknown>[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  rental_phone!: Record<string, unknown>;
}

export class RepairOrderDetailsSwaggerDto extends RepairOrderListItemSwaggerDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  pickups!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  delivery!: Record<string, unknown>;
}
