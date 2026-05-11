import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RepairOrderRentalPhoneDto {
  @ApiProperty({ description: 'Repair-order rental phone record UUID.', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Repair order UUID owning this rental record.', format: 'uuid' })
  repair_order_id!: string;

  @ApiPropertyOptional({
    description: 'Rental phone device UUID. Null while the record is still Pending.',
    format: 'uuid',
    nullable: true,
  })
  rental_phone_device_id!: string | null;

  @ApiPropertyOptional({
    description: 'Device IMEI stored on the rental record.',
    example: '356938035643809',
    nullable: true,
  })
  imei!: string | null;

  @ApiPropertyOptional({
    description: '`true` when the rental is free for the customer.',
    example: false,
    nullable: true,
  })
  is_free!: boolean | null;

  @ApiPropertyOptional({
    description: 'Rental price stored as a database decimal string.',
    example: '50000',
    nullable: true,
  })
  price!: string | null;

  @ApiPropertyOptional({
    enum: ['UZS', 'USD', 'EUR'],
    description: 'Currency used for the rental price.',
    example: 'UZS',
    nullable: true,
  })
  currency!: 'UZS' | 'USD' | 'EUR' | null;

  @ApiProperty({
    enum: ['Pending', 'Active', 'Returned', 'Cancelled'],
    description: 'Current lifecycle state of this repair-order rental phone record.',
    example: 'Active',
  })
  status!: 'Active' | 'Returned' | 'Cancelled' | 'Pending';

  @ApiPropertyOptional({
    description: 'Rental start timestamp.',
    format: 'date-time',
    example: '2026-05-10T09:00:00.000Z',
    nullable: true,
  })
  rented_at!: string | null;

  @ApiPropertyOptional({
    description: 'Rental end timestamp.',
    format: 'date-time',
    example: '2026-05-13T09:00:00.000Z',
    nullable: true,
  })
  returned_at!: string | null;

  @ApiPropertyOptional({
    description: 'Internal rental note shown in repair-order history.',
    example: 'Temporary replacement phone issued during diagnostics.',
    nullable: true,
  })
  notes!: string | null;

  @ApiPropertyOptional({
    description: 'Admin UUID that marked this rental as returned.',
    format: 'uuid',
    nullable: true,
  })
  marked_as_returned_by!: string | null;

  @ApiPropertyOptional({
    description: 'Admin UUID that marked this rental as cancelled.',
    format: 'uuid',
    nullable: true,
  })
  marked_as_cancelled_by!: string | null;

  @ApiProperty({ description: 'Admin UUID that created the rental record.', format: 'uuid' })
  created_by!: string;

  @ApiProperty({
    description: 'Record creation timestamp.',
    format: 'date-time',
    example: '2026-05-10T09:00:00.000Z',
  })
  created_at!: string;

  @ApiProperty({
    description: 'Last update timestamp.',
    format: 'date-time',
    example: '2026-05-10T09:05:00.000Z',
  })
  updated_at!: string;

  @ApiPropertyOptional({
    description: '`true` when the frontend should show the pending-rental toggle state.',
    example: false,
  })
  toggle?: boolean;
}

export class RentalPhoneMessageResponseDto {
  @ApiProperty({
    description: 'Human-readable mutation result.',
    example: 'Rental phone updated',
  })
  message!: string;
}
