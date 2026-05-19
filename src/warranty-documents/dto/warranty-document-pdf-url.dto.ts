import { ApiProperty } from '@nestjs/swagger';

export class WarrantyDocumentPdfUrlDto {
  @ApiProperty({
    example:
      'https://storage.procare.uz/procare-uploads/warranty-documents/current.pdf?X-Amz-Algorithm=...',
  })
  url!: string;

  @ApiProperty({ example: 3600 })
  expires_in!: number;
}
