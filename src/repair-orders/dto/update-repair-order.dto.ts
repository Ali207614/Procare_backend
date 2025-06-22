import {
    IsUUID,
    IsOptional,
    IsEnum,
    IsArray,
    ArrayUnique,
    ValidateNested,
    IsString,
    MaxLength,
    IsNumber,
    ValidateIf,
    Min,
    IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ProblemDto {
    @ApiPropertyOptional()
    @IsUUID('all', { context: { location: 'problem_category_id' } })
    problem_category_id: string;

    @ApiPropertyOptional()
    @IsNumber({}, { context: { location: 'price' } })
    price: number;

    @ApiPropertyOptional()
    @IsNumber({}, { context: { location: 'estimated_minutes' } })
    estimated_minutes: number;
}

class CommentDto {
    @ApiPropertyOptional()
    @IsString({ context: { location: 'text' } })
    @MaxLength(1000, { context: { location: 'text' } })
    text: string;
}

class LocationDto {
    @ApiPropertyOptional()
    @IsNumber({}, { context: { location: 'lat' } })
    lat: number;

    @ApiPropertyOptional()
    @IsNumber({}, { context: { location: 'long' } })
    long: number;

    @ApiPropertyOptional()
    @IsString({ context: { location: 'description' } })
    description: string;
}

class RentalPhoneDto {
    @ApiPropertyOptional({
        example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
        description: 'ID of the rental phone device',
    })
    @IsUUID('all', { context: { location: 'rental_phone_device_id' } })
    rental_phone_device_id: string;

    @ApiPropertyOptional({
        example: true,
        description: 'Indicates if the rental phone is free (no cost)',
    })
    @IsOptional()
    @IsBoolean()
    is_free?: boolean;


    @ApiPropertyOptional({
        example: 50000,
        description: 'Price of the rental phone (0 if free, > 0 if not free)',
    })
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

    @ApiPropertyOptional({
        example: 'UZS',
        enum: ['UZS', 'USD', 'EUR'],
        description: 'Currency of the rental phone price',
    })
    @IsOptional()
    @IsEnum(['UZS', 'USD', 'EUR'], { context: { location: 'currency' } })
    currency?: 'UZS' | 'USD' | 'EUR';

    @ApiPropertyOptional({
        example: 'Temporary replacement for customer during repair',
        description: 'Additional notes about the rental phone',
    })
    @IsOptional()
    @IsString({ context: { location: 'notes' } })
    @MaxLength(1000, { context: { location: 'notes' } })
    notes?: string;
}

export class UpdateRepairOrderDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID('all', { context: { location: 'user_id' } })
    user_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID('all', { context: { location: 'branch_id' } })
    branch_id: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID('all', { context: { location: 'status_id' } })
    status_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID('all', { context: { location: 'phone_category_id' } })
    phone_category_id?: string;

    @ApiPropertyOptional()
    @IsUUID('all', { context: { location: 'courier_id' } })
    courier_id: string;

    @ApiPropertyOptional({ enum: ['Low', 'Medium', 'High', 'Highest'] })
    @IsOptional()
    @IsEnum(['Low', 'Medium', 'High', 'Highest'], { context: { location: 'priority' } })
    priority?: 'Low' | 'Medium' | 'High' | 'Highest';

    @ApiPropertyOptional({ type: [String], description: 'List of admin IDs' })
    @IsOptional()
    @IsArray({ context: { location: 'admin_ids' } })
    @ArrayUnique({ context: { location: 'admin_ids' } })
    @IsUUID('all', { each: true, context: { location: 'admin_ids' } })
    admin_ids?: string[];

    @ApiPropertyOptional({ type: [ProblemDto] })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ProblemDto)
    initial_problems?: ProblemDto[];

    @ApiPropertyOptional({ type: [ProblemDto] })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ProblemDto)
    final_problems?: ProblemDto[];

    @ApiPropertyOptional({ type: [CommentDto] })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CommentDto)
    comments?: CommentDto[];

    @ApiPropertyOptional({ type: LocationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => LocationDto)
    pickup?: LocationDto;

    @ApiPropertyOptional({ type: LocationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => LocationDto)
    delivery?: LocationDto;

    @ApiPropertyOptional({ type: RentalPhoneDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => RentalPhoneDto)
    rental_phone?: RentalPhoneDto;
}
