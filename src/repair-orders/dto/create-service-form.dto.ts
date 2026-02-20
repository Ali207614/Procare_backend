import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ServiceFormFormDto {
  @ApiProperty({ example: '2026-02-18' })
  @IsString()
  date!: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  pin!: string;
}

export class ServiceFormChecklistItemDto {
  @ApiProperty({ example: 'display-1' })
  @IsString()
  id!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  checked!: boolean;
}

export class ServiceFormChecklistDto {
  @ApiProperty({ type: [ServiceFormChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceFormChecklistItemDto)
  display!: ServiceFormChecklistItemDto[];

  @ApiProperty({ type: [ServiceFormChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceFormChecklistItemDto)
  body!: ServiceFormChecklistItemDto[];

  @ApiProperty({ type: [ServiceFormChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceFormChecklistItemDto)
  'ports-1'!: ServiceFormChecklistItemDto[];

  @ApiProperty({ type: [ServiceFormChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceFormChecklistItemDto)
  ports!: ServiceFormChecklistItemDto[];

  @ApiProperty({ type: [ServiceFormChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceFormChecklistItemDto)
  other!: ServiceFormChecklistItemDto[];
}

export class DevicePointDto {
  @ApiProperty({ example: 0.25 })
  @IsNumber()
  x!: number;

  @ApiProperty({ example: 0.4 })
  @IsNumber()
  y!: number;
}

export class CreateServiceFormDto {
  @ApiProperty({ example: [1, 2, 4, 5], description: 'Device unlock pattern' })
  @IsArray()
  @IsNumber({}, { each: true })
  pattern!: number[];

  @ApiProperty({
    example: { view1: [{ x: 0.25, y: 0.4 }], view2: [] },
    description: 'Device damage points per view',
  })
  @IsObject()
  device_points!: Record<string, DevicePointDto[]>;

  @ApiProperty({ type: ServiceFormFormDto })
  @ValidateNested()
  @Type(() => ServiceFormFormDto)
  form!: ServiceFormFormDto;

  @ApiProperty({ type: ServiceFormChecklistDto })
  @ValidateNested()
  @Type(() => ServiceFormChecklistDto)
  checklist!: ServiceFormChecklistDto;

  @ApiPropertyOptional({ example: 'Ekran burchagida xira joy bor.' })
  @IsOptional()
  @IsString()
  comments!: string;
}
