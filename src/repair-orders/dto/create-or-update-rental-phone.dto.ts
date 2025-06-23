import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsBoolean, IsNumber, IsEnum, IsString, MaxLength, ValidateIf, Min } from 'class-validator';

export class CreateOrUpdateRentalPhoneDto {
    @ApiProperty({ description: 'ID of the rental phone device' })
    @IsUUID('all', { context: { location: 'rental_phone_device_id' } })
    rental_phone_device_id: string;

    @ApiPropertyOptional({ description: 'Whether the rental is free (true = no price)' })
    @IsOptional()
    @IsBoolean()
    is_free?: boolean;

    @ApiPropertyOptional({ description: 'Rental price if not free' })
    @IsOptional()
    @IsNumber({}, { context: { location: 'price' } })
    @ValidateIf((o) => o.is_free === false || o.is_free === undefined)
    @Min(1, {
        context: { location: 'price' },
        message: 'Price must be greater than 0 when is_free is false or undefined',
    })
    @ValidateIf((o) => o.is_free === true)
    @Min(0, {
        context: { location: 'price' },
        message: 'Price must be 0 when is_free is true',
    })
    price?: number;

    @ApiPropertyOptional({ enum: ['UZS', 'USD', 'EUR'], description: 'Currency of rental price' })
    @IsOptional()
    @IsEnum(['UZS', 'USD', 'EUR'], { context: { location: 'currency' } })
    currency?: 'UZS' | 'USD' | 'EUR';

    @ApiPropertyOptional({ description: 'Optional notes or reason for rental' })
    @IsOptional()
    @IsString({ context: { location: 'notes' } })
    @MaxLength(1000, { context: { location: 'notes' } })
    notes?: string;
}
