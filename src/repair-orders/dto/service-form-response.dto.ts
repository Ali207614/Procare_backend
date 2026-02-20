import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceFormResponseDto {
  @ApiProperty({ example: 'SF-A3B9K2', description: 'Generated unique warranty ID' })
  warranty_id!: string;

  @ApiProperty({ example: 'Service form generated successfully' })
  message!: string;
}

export class GetServiceFormResponseDto {
  @ApiProperty({ example: 'SF-A3B9K2', description: 'Latest warranty ID for this repair order' })
  warranty_id!: string;

  @ApiProperty({
    example: 'https://storage.procare.uz/service-forms/uuid/SF-A3B9K2.pdf',
    description: 'Presigned URL to download the PDF (expires in 1 hour)',
  })
  url!: string;
}
