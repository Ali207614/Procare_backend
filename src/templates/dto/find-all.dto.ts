import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type, Transform, TransformFnParams } from 'class-transformer';

export enum TemplateStatus {
  Draft = 'Draft',
  Open = 'Open',
  Deleted = 'Deleted',
}

export enum TemplateLanguage {
  UZ = 'uz',
  RU = 'ru',
  EN = 'en',
}

export class FindAllTemplatesDto {
  @ApiPropertyOptional({
    description: 'Number of results (default: 10)',
    type: Number,
    minimum: 1,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Offset (default: 0)',
    type: Number,
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({
    description: 'Filter by multiple statuses',
    enum: TemplateStatus,
    isArray: true,
    example: [TemplateStatus.Open, TemplateStatus.Draft],
  })
  @IsOptional()
  @IsEnum(TemplateStatus, { each: true })
  @Transform(({ value }: TransformFnParams) => {
    if (Array.isArray(value)) {
      return value as TemplateStatus[];
    }
    return [value] as TemplateStatus[];
  })
  status?: TemplateStatus[];

  @ApiPropertyOptional({
    description: 'Filter by language',
    enum: TemplateLanguage,
    example: TemplateLanguage.UZ,
  })
  @IsOptional()
  @IsEnum(TemplateLanguage)
  language?: TemplateLanguage;

  @ApiPropertyOptional({
    description: 'Search by title or body',
    type: String,
    maxLength: 100,
    example: 'welcome',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
