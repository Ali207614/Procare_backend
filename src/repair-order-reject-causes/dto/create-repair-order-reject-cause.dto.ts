import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRepairOrderRejectCauseDto {
  @ApiProperty({
    example: 'Client rejected the price',
    description: 'Human-readable reject cause name',
  })
  @Transform(({ value }): string => (typeof value === 'string' ? value.trim() : value))
  @IsString({ context: { location: 'name' } })
  @MinLength(1, { context: { location: 'name' } })
  @MaxLength(150, { context: { location: 'name' } })
  name!: string;

  @ApiPropertyOptional({
    example: 'Customer decided not to continue after pricing was shared.',
    description: 'Optional internal description of the reject cause',
  })
  @Transform(({ value }): string | null | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  })
  @IsOptional()
  @IsString({ context: { location: 'description' } })
  @MaxLength(500, { context: { location: 'description' } })
  description?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the reject cause can be assigned to repair orders',
  })
  @IsOptional()
  @IsBoolean({ context: { location: 'is_active' } })
  is_active?: boolean;
}
