import { ApiProperty } from '@nestjs/swagger';

export class AttachmentUrlsDto {
  @ApiProperty({ example: 'https://storage.example.com/small.jpg', required: false })
  small?: string;

  @ApiProperty({ example: 'https://storage.example.com/medium.jpg', required: false })
  medium?: string;

  @ApiProperty({ example: 'https://storage.example.com/large.jpg', required: false })
  large?: string;
}

export class AttachmentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  repair_order_id!: string;

  @ApiProperty({ example: 'screen.png' })
  original_name!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000.png' })
  file_name!: string;

  @ApiProperty({ example: 'repair-orders/uuid/uuid' })
  file_path!: string;

  @ApiProperty({ example: 1024 })
  file_size!: number;

  @ApiProperty({ example: 'image/png' })
  mime_type!: string;

  @ApiProperty({ example: 'Damaged screen photo', nullable: true })
  description!: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  uploaded_by!: string;

  @ApiProperty({ example: '2023-10-01T12:00:00Z' })
  created_at!: Date;

  @ApiProperty({ example: '2023-10-01T12:00:00Z' })
  updated_at!: Date;

  @ApiProperty({ type: AttachmentUrlsDto })
  urls!: AttachmentUrlsDto;
}

export class UploadAttachmentDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'File to upload' })
  file!: Express.Multer.File;

  @ApiProperty({ example: 'Damaged screen photo', required: false })
  description?: string;
}
