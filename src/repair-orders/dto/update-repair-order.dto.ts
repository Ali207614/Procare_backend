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

export class UpdateRepairOrderDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID('all', { context: { location: 'user_id' } })
    user_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID('all', { context: { location: 'status_id' } })
    status_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID('all', { context: { location: 'phone_category_id' } })
    phone_category_id?: string;

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
}
