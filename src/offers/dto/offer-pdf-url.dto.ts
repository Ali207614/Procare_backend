import { ApiProperty } from '@nestjs/swagger';

export class OfferPdfUrlDto {
  @ApiProperty({
    example: 'https://storage.procare.uz/procare-uploads/offers/current.pdf?X-Amz-Algorithm=...',
  })
  url!: string;

  @ApiProperty({ example: 3600 })
  expires_in!: number;
}
