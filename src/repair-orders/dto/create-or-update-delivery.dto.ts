import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrUpdateDeliveryDto {
  @ApiProperty()
  @IsNumber({}, { context: { location: 'lat' } })
  lat!: number;

  @ApiProperty()
  @IsNumber({}, { context: { location: 'long' } })
  long!: number;

  @ApiProperty()
  @IsString({ context: { location: 'description' } })
  @MaxLength(1000, { context: { location: 'description' } })
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all', { context: { location: 'courier_id' } })
  courier_id?: string;
}
