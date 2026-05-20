import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateWarrantyAgreementDto {
  @ApiProperty({
    example: '2026-05-19',
    description: 'Repair date in YYYY-MM-DD format',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'repair_date must be a valid date in YYYY-MM-DD format',
  })
  repair_date!: string;

  @ApiProperty({
    example: '2026-05-20',
    description: 'Delivery date in YYYY-MM-DD format',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'delivery_date must be a valid date in YYYY-MM-DD format',
  })
  delivery_date!: string;
}
