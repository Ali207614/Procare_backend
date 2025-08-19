import { IsString, IsOptional, IsEnum, IsInt, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCampaignRecipientDto {
  @ApiProperty({ example: 123456, description: 'Telegram message ID', required: false })
  @IsOptional()
  @IsInt()
  message_id?: number;

  @ApiProperty({
    enum: ['sent', 'delivered', 'read', 'failed', 'blocked', 'unsubscribed'],
    description: 'Recipient status',
    required: false,
  })
  @IsOptional()
  @IsEnum(['sent', 'delivered', 'read', 'failed', 'blocked', 'unsubscribed'])
  status?: 'sent' | 'delivered' | 'read' | 'failed' | 'blocked' | 'unsubscribed';

  @ApiProperty({
    example: 'Error message',
    description: 'Error description if status is failed',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Error message must be at most 500 characters long' })
  error?: string;

  @ApiProperty({ example: '2025-08-18T10:00:00Z', description: 'Sent timestamp', required: false })
  @IsOptional()
  @IsString()
  sent_at?: string;

  @ApiProperty({
    example: '2025-08-18T10:01:00Z',
    description: 'Delivered timestamp',
    required: false,
  })
  @IsOptional()
  @IsString()
  delivered_at?: string;

  @ApiProperty({ example: '2025-08-18T10:02:00Z', description: 'Read timestamp', required: false })
  @IsOptional()
  @IsString()
  read_at?: string;
}
