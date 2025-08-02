import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayUnique,
  IsNumber,
  IsString,
  MaxLength,
  ValidateNested,
  IsBoolean,
  ValidateIf,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class ProblemPartInputDto {
  @ApiProperty({
    description: 'Repair part ID',
    example: '7b2e2f60-5f0c-4c44-b2bb-6d7d0eeb7c6c',
  })
  @IsUUID('all', { message: 'Invalid part ID' })
  id!: string;

  @ApiProperty({
    description: 'Custom price for the part',
    example: 12000,
  })
  @IsNumber({}, { message: 'Part price must be a number' })
  @Min(0, { message: 'Part price cannot be negative' })
  part_price!: number;
}

class ProblemDto {
  @ApiProperty({
    description: 'Problem category ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsUUID('all', { message: 'Invalid problem category ID' })
  problem_category_id!: string;

  @ApiProperty({ description: 'Price of the problem', example: 100000 })
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price cannot be negative' })
  price!: number;

  @ApiProperty({ description: 'Estimated minutes for repair', example: 60 })
  @IsNumber({}, { message: 'Estimated minutes must be a number' })
  @Min(0, { message: 'Estimated minutes cannot be negative' })
  estimated_minutes!: number;

  @ApiProperty({
    description: 'List of used parts with custom prices',
    type: [ProblemPartInputDto],
  })
  @IsArray({ message: 'Parts must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ProblemPartInputDto)
  parts!: ProblemPartInputDto[];
}

class CommentDto {
  @ApiProperty({ description: 'Comment text', example: 'Device has water damage' })
  @IsString({ message: 'Comment text must be a string' })
  @MaxLength(1000, { message: 'Comment text must not exceed 1000 characters' })
  text!: string;
}

class LocationDto {
  @ApiProperty({ description: 'Latitude coordinate', example: 41.2995 })
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  lat!: number;

  @ApiProperty({ description: 'Longitude coordinate', example: 69.2401 })
  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  long!: number;

  @ApiProperty({ description: 'Location description', example: 'Main office' })
  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description!: string;

  @ApiPropertyOptional({
    description: 'Courier ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Invalid courier ID' })
  courier_id?: string;
}

class RentalPhoneDto {
  @ApiProperty({
    description: 'Rental phone device ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsUUID('all', { message: 'Invalid rental phone device ID' })
  rental_phone_device_id!: string;

  @ApiPropertyOptional({ description: 'Indicates if the rental phone is free', example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_free must be a boolean' })
  is_free?: boolean;

  @ApiPropertyOptional({ description: 'Price of the rental phone', example: 50000 })
  @IsOptional()
  @IsNumber({}, { message: 'Price must be a number' })
  @ValidateIf((o) => o.is_free === false || o.is_free === undefined)
  @Min(1, { message: 'Price must be greater than 0 when is_free is false or undefined' })
  @ValidateIf((o) => o.is_free === true)
  @Min(0, { message: 'Price must be 0 when is_free is true' })
  price?: number;

  @ApiPropertyOptional({
    description: 'Currency of the rental phone price',
    example: 'UZS',
    enum: ['UZS', 'USD', 'EUR'],
  })
  @IsOptional()
  @ValidateIf((o) => o.price !== undefined)
  @IsEnum(['UZS', 'USD', 'EUR'], { message: 'Currency must be UZS, USD, or EUR' })
  currency?: 'UZS' | 'USD' | 'EUR';

  @ApiPropertyOptional({ description: 'Additional notes', example: 'Temporary replacement' })
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(1000, { message: 'Notes must not exceed 1000 characters' })
  notes?: string;
}

export class CreateRepairOrderDto {
  @ApiProperty({ description: 'User ID', example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec' })
  @IsUUID('all', { message: 'Invalid user ID' })
  user_id!: string;

  @ApiProperty({
    description: 'Phone category ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsUUID('all', { message: 'Invalid phone category ID' })
  phone_category_id!: string;

  @ApiProperty({ description: 'Status ID', example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec' })
  @IsUUID('all', { message: 'Invalid status ID' })
  status_id!: string;

  @ApiPropertyOptional({
    description: 'Priority level',
    enum: ['Low', 'Medium', 'High', 'Highest'],
  })
  @IsOptional()
  @IsEnum(['Low', 'Medium', 'High', 'Highest'], {
    message: 'Priority must be Low, Medium, High, or Highest',
  })
  priority?: 'Low' | 'Medium' | 'High' | 'Highest';

  @ApiProperty({ description: 'List of admin IDs', type: [String] })
  @IsOptional()
  @IsArray({ message: 'Admin IDs must be an array' })
  @ArrayUnique({ message: 'Admin IDs must be unique' })
  @IsUUID('all', { each: true, message: 'Each admin ID must be a valid UUID' })
  admin_ids?: string[];

  @ApiProperty({ description: 'Initial problems', type: [ProblemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProblemDto)
  initial_problems?: ProblemDto[];

  @ApiProperty({ description: 'Final problems', type: [ProblemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProblemDto)
  final_problems?: ProblemDto[];

  @ApiProperty({ description: 'Comments', type: [CommentDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CommentDto)
  comments?: CommentDto[];

  @ApiProperty({ description: 'Pickup location', type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  pickup?: LocationDto;

  @ApiProperty({ description: 'Delivery location', type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  delivery?: LocationDto;

  @ApiProperty({ description: 'Rental phone details', type: RentalPhoneDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RentalPhoneDto)
  rental_phone?: RentalPhoneDto;
}
