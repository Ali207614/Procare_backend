import { IsUUID, IsOptional, IsBoolean, IsNumber, Min, ValidateIf } from 'class-validator';

export class UpdateRentalPhoneDto {
  @IsOptional()
  @IsUUID()
  rental_phone_device_id?: string;

  @IsOptional()
  @IsBoolean()
  is_free?: boolean;

  @ValidateIf((o) => !o.is_free)
  @IsNumber()
  @Min(0)
  rental_price?: number;

  @ValidateIf((o) => !o.is_free)
  @IsNumber()
  @Min(0)
  price_per_day?: number;
}
