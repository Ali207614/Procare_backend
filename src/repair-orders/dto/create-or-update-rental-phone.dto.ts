import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsString,
  MaxLength,
  ValidateIf,
  Min,
  IsNotEmpty,
  IsIn,
} from 'class-validator';

export class CreateOrUpdateRentalPhoneDto {
  @ApiPropertyOptional({
    description:
      'Available rental phone device UUID. Required when `status` is `Active`; omitted for `Pending` records.',
    format: 'uuid',
    example: 'b8b3db3b-19b5-4f31-a1f5-91e6d4bca2f4',
  })
  @ValidateIf((o) => o.status === 'Active')
  @IsNotEmpty({
    message: 'rental_phone_id is required when status is Active',
    context: { location: 'rental_phone_id_required' },
  })
  @IsUUID('all', { context: { location: 'rental_phone_id_format' } })
  rental_phone_id?: string | null;

  @ApiPropertyOptional({
    description: 'IMEI copied from the rental phone device or entered manually for audit purposes.',
    example: '356938035643809',
    nullable: true,
  })
  @IsOptional()
  @IsString({ context: { location: 'imei_format' } })
  imei?: string | null;

  @ApiPropertyOptional({
    description: '`true` when the customer should not be charged for this rental.',
    example: false,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_free_boolean' } })
  is_free?: boolean | null;

  @ApiPropertyOptional({
    description:
      'Rental price for the selected period. Required when `status` is `Active`; can be `0` for free rentals.',
    minimum: 0,
    example: 50000,
    nullable: true,
  })
  @ValidateIf((o) => o.status === 'Active')
  @IsNotEmpty({
    message: 'price is required when status is Active',
    context: { location: 'price_required' },
  })
  @IsNumber({}, { context: { location: 'price_number' } })
  @Min(0, {
    context: { location: 'price_min' },
    message: 'Price cannot be negative',
  })
  price?: number | null;

  @ApiPropertyOptional({
    enum: ['UZS', 'USD', 'EUR'],
    description:
      'Currency of the rental price. Defaults to the selected device currency when omitted.',
    example: 'UZS',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['UZS', 'USD', 'EUR'], {
    context: { location: 'currency_value' },
    message: 'Currency must be one of the following values: UZS, USD, EUR',
  })
  currency?: 'UZS' | 'USD' | 'EUR' | null;

  @ApiPropertyOptional({
    description: 'Internal note shown in the repair order history.',
    maxLength: 1000,
    example: 'Temporary replacement phone issued while diagnostics are in progress.',
    nullable: true,
  })
  @IsOptional()
  @IsString({ context: { location: 'notes_format' } })
  @MaxLength(1000, { context: { location: 'notes_max' } })
  notes?: string | null;

  @ApiProperty({
    enum: ['Pending', 'Active', 'Returned', 'Cancelled'],
    description:
      '`Pending` reserves the intent to issue a rental phone. `Active` requires device, price, rented_at, and returned_at fields. `Returned` and `Cancelled` are terminal statuses.',
    example: 'Active',
  })
  @IsIn(['Pending', 'Active', 'Returned', 'Cancelled'], {
    context: { location: 'status_value' },
    message: 'Status must be one of the following values: Pending, Active, Returned, Cancelled',
  })
  status!: 'Pending' | 'Active' | 'Returned' | 'Cancelled';

  @ApiPropertyOptional({
    description: 'ISO date-time when the rental starts. Required when `status` is `Active`.',
    format: 'date-time',
    example: '2026-05-10T09:00:00.000Z',
    nullable: true,
  })
  @ValidateIf((o) => o.status === 'Active')
  @IsNotEmpty({
    message: 'rented_at is required when status is Active',
    context: { location: 'rented_at_required' },
  })
  @IsString({ context: { location: 'rented_at_format' } })
  rented_at?: string | null;

  @ApiPropertyOptional({
    description:
      'Planned or actual ISO date-time when the rental ends. Required when `status` is `Active`.',
    format: 'date-time',
    example: '2026-05-13T09:00:00.000Z',
    nullable: true,
  })
  @ValidateIf((o) => o.status === 'Active')
  @IsNotEmpty({
    message: 'returned_at is required when status is Active',
    context: { location: 'returned_at_required' },
  })
  @IsString({ context: { location: 'returned_at_format' } })
  returned_at?: string | null;
}
