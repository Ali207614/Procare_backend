import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  IsInt,
} from 'class-validator';

export class FindAllPartsDto {
  @ApiPropertyOptional({ example: 10, description: 'How many items to fetch (limit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 0, description: 'Starting index for pagination (offset)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    example: 'battery',
    description: 'Search term (minimum 3 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search term must be at most 100 characters long' })
  search?: string;

  @ApiPropertyOptional({
    enum: ['Open', 'Deleted'],
    description: 'Filter by part status',
    example: 'Open',
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value, obj }): string[] | undefined => {
    // Handle status, status[], or even malformed keys
    const rawObj = obj as Record<string, unknown>;
    const rawValue =
      value ??
      rawObj['status'] ??
      rawObj['status[]'] ??
      rawObj[Object.keys(rawObj).find((k) => k.startsWith('status')) || ''];

    if (rawValue === null || rawValue === undefined) return undefined;

    const items = Array.isArray(rawValue)
      ? (rawValue as unknown[]).flat(Infinity)
      : String(rawValue).split(',');

    return items
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const keys = Object.keys(item);
          return keys.length > 0 ? keys[0] : '';
        }
        return String(item);
      })
      .map((s) => s.replace(/[\[\]"']/g, '').trim())
      .filter((s) => s !== '' && s !== 'undefined' && s !== 'null') as ('Open' | 'Deleted')[];
  })
  @IsArray()
  @IsIn(['Open', 'Deleted'], {
    each: true,
    message: 'Status must be one of the following values: Open, Deleted',
  })
  status?: ('Open' | 'Deleted')[];

  @ApiPropertyOptional({
    type: [String],
    description: 'List of problem category IDs (UUID format)',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @Transform(({ value, obj }): string[] | undefined => {
    const rawObj = obj as Record<string, unknown>;
    const rawValue =
      value ??
      rawObj['problem_category_ids'] ??
      rawObj['problem_category_ids[]'] ??
      rawObj[Object.keys(rawObj).find((k) => k.startsWith('problem_category_ids')) || ''];

    if (rawValue === null || rawValue === undefined) return undefined;

    const items = Array.isArray(rawValue)
      ? (rawValue as unknown[]).flat(Infinity)
      : String(rawValue).split(',');

    return items
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const keys = Object.keys(item);
          return keys.length > 0 ? keys[0] : '';
        }
        return String(item);
      })
      .map((s) => s.replace(/[\[\]"']/g, '').trim())
      .filter((s) => s !== '' && s !== 'undefined' && s !== 'null');
  })
  @IsArray()
  @IsUUID('all', { each: true })
  problem_category_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Exclude by problem category IDs (UUID format)',
    example: ['550e8400-e29b-41d4-a716-446655440111'],
  })
  @IsOptional()
  @Transform(({ value, obj }): string[] | undefined => {
    const rawObj = obj as Record<string, unknown>;
    const rawValue =
      value ??
      rawObj['exclude_problem_category_ids'] ??
      rawObj['exclude_problem_category_ids[]'] ??
      rawObj[Object.keys(rawObj).find((k) => k.startsWith('exclude_problem_category_ids')) || ''];

    if (rawValue === null || rawValue === undefined) return undefined;

    const items = Array.isArray(rawValue)
      ? (rawValue as unknown[]).flat(Infinity)
      : String(rawValue).split(',');

    return items
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const keys = Object.keys(item);
          return keys.length > 0 ? keys[0] : '';
        }
        return String(item);
      })
      .map((s) => s.replace(/[\[\]"']/g, '').trim())
      .filter((s) => s !== '' && s !== 'undefined' && s !== 'null');
  })
  @IsArray()
  @IsUUID('all', { each: true })
  exclude_problem_category_ids?: string[];
}
