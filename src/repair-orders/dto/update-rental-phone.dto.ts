import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsBoolean, IsNumber, Min, ValidateIf } from 'class-validator';

export class UpdateRentalPhoneDto {
  @ApiPropertyOptional({
    description:
      'Replacement rental phone device UUID. When changed, the previous device is released and the new device is marked as rented.',
    format: 'uuid',
    example: 'b8b3db3b-19b5-4f31-a1f5-91e6d4bca2f4',
  })
  @IsOptional()
  @IsUUID('all', { context: { location: 'rental_phone_device_id_format' } })
  rental_phone_device_id?: string;

  @ApiPropertyOptional({
    description: '`true` when this rental phone record should not have a customer charge.',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_free_boolean' } })
  is_free?: boolean;

  @ApiPropertyOptional({
    description: 'Updated total rental price. Ignored when omitted.',
    minimum: 0,
    example: 50000,
  })
  @IsOptional()
  @ValidateIf((o) => !o.is_free)
  @IsNumber({}, { context: { location: 'rental_price_number' } })
  @Min(0, { context: { location: 'rental_price_min' } })
  rental_price?: number;

  @ApiPropertyOptional({
    description: 'Updated daily price accepted for client compatibility.',
    minimum: 0,
    example: 25000,
  })
  @IsOptional()
  @ValidateIf((o) => !o.is_free)
  @IsNumber({}, { context: { location: 'price_per_day_number' } })
  @Min(0, { context: { location: 'price_per_day_min' } })
  price_per_day?: number;
}
