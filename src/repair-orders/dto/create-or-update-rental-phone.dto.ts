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
  @ApiProperty({ description: 'ID of the rental phone', required: false })
  @ValidateIf((o) => o.status === 'Active')
  @IsNotEmpty({ message: 'rental_phone_id is required when status is Active' })
  @IsUUID('all', { context: { location: 'rental_phone_id' } })
  rental_phone_id?: string | null;

  @ApiPropertyOptional({ description: 'IMEI of the rental phone' })
  @IsOptional()
  @IsString({ context: { location: 'imei' } })
  imei?: string | null;

  @ApiPropertyOptional({ description: 'Whether the rental is free (true = no price)' })
  @IsOptional()
  @IsBoolean()
  is_free?: boolean | null;

  @ApiPropertyOptional({ description: 'Rental price if not free' })
  @ValidateIf((o) => o.status === 'Active')
  @IsNotEmpty({ message: 'price is required when status is Active' })
  @IsNumber({}, { context: { location: 'price' } })
  @Min(0, {
    context: { location: 'price' },
    message: 'Price cannot be negative',
  })
  price?: number | null;

  @ApiPropertyOptional({ enum: ['UZS', 'USD', 'EUR'], description: 'Currency of rental price' })
  @IsOptional()
  @IsIn(['UZS', 'USD', 'EUR'], {
    context: { location: 'currency' },
    message: 'Currency must be one of the following values: UZS, USD, EUR',
  })
  currency?: 'UZS' | 'USD' | 'EUR' | null;

  @ApiPropertyOptional({ description: 'Optional notes or reason for rental' })
  @IsOptional()
  @IsString({ context: { location: 'notes' } })
  @MaxLength(1000, { context: { location: 'notes' } })
  notes?: string | null;

  @ApiProperty({
    enum: ['Pending', 'Active', 'Returned', 'Cancelled'],
    description: 'Status of the rental',
  })
  @IsIn(['Pending', 'Active', 'Returned', 'Cancelled'], {
    context: { location: 'status' },
    message: 'Status must be one of the following values: Pending, Active, Returned, Cancelled',
  })
  status!: 'Pending' | 'Active' | 'Returned' | 'Cancelled';

  @ApiPropertyOptional({ description: 'The date the phone was rented' })
  @ValidateIf((o) => o.status === 'Active')
  @IsNotEmpty({ message: 'rented_at is required when status is Active' })
  @IsString()
  rented_at?: string | null;

  @ApiPropertyOptional({ description: 'The date the phone was returned' })
  @ValidateIf((o) => o.status === 'Active')
  @IsNotEmpty({ message: 'returned_at is required when status is Active' })
  @IsString()
  returned_at?: string | null;
}
