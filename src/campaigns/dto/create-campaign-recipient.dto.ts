import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampaignRecipientDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Campaign ID' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  campaign_id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  user_id!: string;

  @ApiProperty({ example: 123456, description: 'Telegram message ID', required: false })
  @IsOptional()
  @IsInt()
  message_id?: number;

  @ApiProperty({
    enum: ['sent', 'delivered', 'read', 'failed', 'blocked', 'unsubscribed'],
    description: 'Recipient status',
  })
  @IsEnum(['sent', 'delivered', 'read', 'failed', 'blocked', 'unsubscribed'])
  status!: 'sent' | 'delivered' | 'read' | 'failed' | 'blocked' | 'unsubscribed';

  @ApiProperty({
    example: 'Error message',
    description: 'Error description if status is failed',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Error message must be at most 500 characters long' })
  error?: string;
}
