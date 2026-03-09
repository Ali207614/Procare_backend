import { ApiProperty } from '@nestjs/swagger';

export class OfferDto {
  @ApiProperty({ example: '7b8f9e0a-1a2b-3c4d-5e6f-7a8b9c0d1e2f' })
  id!: string;

  @ApiProperty({ example: 'Ushbu ommaviy ofera qoidalari...' })
  content_uz!: string;

  @ApiProperty({ example: 'Настоящие правила...', nullable: true })
  content_ru!: string | null;

  @ApiProperty({ example: 'These public offer rules...', nullable: true })
  content_en!: string | null;

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'] })
  status!: 'Open' | 'Deleted';

  @ApiProperty({ example: '2024-03-09T06:48:39.000Z' })
  created_at!: Date;

  @ApiProperty({ example: '2024-03-09T06:48:39.000Z' })
  updated_at!: Date;
}

export class PaginatedOffersDto {
  @ApiProperty({ type: [OfferDto] })
  rows!: OfferDto[];

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}
