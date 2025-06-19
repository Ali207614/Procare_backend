import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsUUID, IsOptional, IsEnum, IsArray, ArrayNotEmpty,
    ArrayUnique, IsNumber, IsString, MaxLength, ValidateNested, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class ProblemDto {
    @ApiProperty()
    @IsUUID('all', { context: { location: 'problem_category_id' } })
    problem_category_id: string;

    @ApiProperty()
    @IsNumber({}, { context: { location: 'price' } })
    price: number;

    @ApiProperty()
    @IsNumber({}, { context: { location: 'estimated_minutes' } })
    estimated_minutes: number;
}

class CommentDto {
    @ApiProperty()
    @IsString({ context: { location: 'text' } })
    @MaxLength(1000, { context: { location: 'text' } })
    text: string;
}

class LocationDto {
    @ApiProperty()
    @IsNumber({}, { context: { location: 'lat' } })
    lat: number;

    @ApiProperty()
    @IsNumber({}, { context: { location: 'long' } })
    long: number;

    @ApiProperty()
    @IsString({ context: { location: 'description' } })
    @MaxLength(1000, { context: { location: 'text' } })
    description: string;
}

export class CreateRepairOrderDto {
    @ApiProperty()
    @IsUUID('all', { context: { location: 'user_id' } })
    user_id: string;

    @ApiProperty()
    @IsUUID('all', { context: { location: 'phone_category_id' } })
    phone_category_id: string;

    @ApiProperty()
    @IsUUID('all', { context: { location: 'branch_id' } })
    branch_id: string;

    @ApiProperty()
    @IsUUID('all', { context: { location: 'status_id' } })
    status_id: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID('all', { context: { location: 'courier_id' } })
    courier_id: string;

    @ApiPropertyOptional({ enum: ['Low', 'Medium', 'High', 'Highest'] })
    @IsOptional()
    @IsEnum(['Low', 'Medium', 'High', 'Highest'], { context: { location: 'priority' } })
    priority?: 'Low' | 'Medium' | 'High' | 'Highest';

    @ApiProperty({ type: [String] })
    @IsArray({ context: { location: 'admin_ids' } })
    @ArrayNotEmpty({ context: { location: 'admin_ids' } })
    @ArrayUnique({ context: { location: 'admin_ids' } })
    @IsUUID('all', { each: true, context: { location: 'admin_ids' } })
    admin_ids: string[];

    @ApiProperty({ type: [ProblemDto] })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ProblemDto)
    initial_problems?: ProblemDto[];

    @ApiProperty({ type: [ProblemDto] })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ProblemDto)
    final_problems?: ProblemDto[];

    @ApiProperty({ type: [CommentDto] })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CommentDto)
    comments?: CommentDto[];

    @ApiProperty({ type: LocationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => LocationDto)
    pickup?: LocationDto;

    @ApiProperty({ type: LocationDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => LocationDto)
    delivery?: LocationDto;
}
