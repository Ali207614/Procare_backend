import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRepairOrderRegionDto {
  @ApiProperty({
    example: 'Tashkent City',
    description: 'Human-readable repair order region title',
  })
  @Transform(({ value }): string => (typeof value === 'string' ? value.trim() : value))
  @IsString({ context: { location: 'title' } })
  @MinLength(1, { context: { location: 'title' } })
  @MaxLength(150, { context: { location: 'title' } })
  title!: string;

  @ApiPropertyOptional({
    example: 'Central city region for walk-in and courier jobs.',
    description: 'Optional internal description for the region',
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
}
