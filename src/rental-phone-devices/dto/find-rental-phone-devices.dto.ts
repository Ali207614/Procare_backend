import { IsOptional, IsString, IsEnum, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindRentalPhoneDevicesDto {
    @ApiPropertyOptional({ description: 'Search by name or code' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    page?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    limit?: number;

    @ApiPropertyOptional({ enum: ['sort', 'created_at'] })
    @IsOptional()
    @IsEnum(['sort', 'created_at'])
    sortBy?: 'sort' | 'created_at';

    @ApiPropertyOptional({ enum: ['asc', 'desc'] })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc';
}
