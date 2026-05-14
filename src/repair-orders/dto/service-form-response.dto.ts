import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DevicePointDto,
  ServiceFormChecklistDto,
  ServiceFormFormDto,
} from './create-service-form.dto';

export class CreateServiceFormResponseDto {
  @ApiProperty({ example: 'SF-A3B9K2', description: 'Generated unique warranty ID' })
  warranty_id!: string;

  @ApiProperty({ example: 'Service form generated successfully' })
  message!: string;
}

export class CreateWarrantyAgreementResponseDto {
  @ApiProperty({ example: 'SF-A3B9K2', description: 'Warranty ID used for the agreement PDF' })
  warranty_id!: string;

  @ApiProperty({
    example: 'https://storage.procare.uz/warranty-agreements/uuid/SF-A3B9K2.pdf',
    description: 'Presigned URL to download the generated warranty agreement PDF',
  })
  url!: string;

  @ApiProperty({ example: 'Warranty agreement generated successfully' })
  message!: string;
}

export class WarrantyAgreementSseDataDto {
  @ApiProperty({
    example: 'pdf_generated',
    enum: ['started', 'data_loaded', 'pdf_generated', 'uploaded', 'completed', 'failed'],
  })
  state!: string;

  @ApiProperty({ example: 'Warranty agreement PDF generated' })
  message!: string;

  @ApiProperty({ type: CreateWarrantyAgreementResponseDto, required: false })
  result?: CreateWarrantyAgreementResponseDto;
}

export class GetServiceFormResponseDto {
  @ApiProperty({ example: 'SF-A3B9K2', description: 'Latest warranty ID for this repair order' })
  warranty_id!: string;

  @ApiProperty({
    example: 'https://storage.procare.uz/service-forms/uuid/SF-A3B9K2.pdf',
    description: 'Presigned URL to download the PDF (expires in 1 hour)',
  })
  url!: string;

  @ApiProperty({ example: [1, 2, 4, 5] })
  pattern!: number[];

  @ApiProperty({ example: { view1: [{ x: 0.25, y: 0.4 }] } })
  device_points!: Record<string, DevicePointDto[]>;

  @ApiProperty({ type: ServiceFormFormDto })
  form!: ServiceFormFormDto;

  @ApiProperty({ type: ServiceFormChecklistDto })
  checklist!: ServiceFormChecklistDto;

  @ApiPropertyOptional({ example: 'Ekran burchagida xira joy bor.' })
  comments!: string | null;
}
