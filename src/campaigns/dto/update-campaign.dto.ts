import { IsString, IsOptional, IsEnum, IsJSON, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCampaignDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Template ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  template_id?: string;

  @ApiProperty({ example: '{}', description: 'JSON filters for targeting users', required: false })
  @IsOptional()
  @IsJSON()
  filters?: string;

  @ApiProperty({ enum: ['now', 'schedule'], description: 'Send type', required: false })
  @IsOptional()
  @IsEnum(['now', 'schedule'])
  send_type?: 'now' | 'schedule';

  @ApiProperty({
    example: '2025-08-20T10:00:00Z',
    description: 'Scheduled time (if send_type is schedule)',
    required: false,
  })
  @IsOptional()
  @IsString()
  schedule_at?: string;

  @ApiProperty({ example: '{}', description: 'A/B test configuration (JSON)', required: false })
  @IsOptional()
  @IsJSON()
  ab_test?: string;

  @ApiProperty({
    enum: ['queued', 'scheduled', 'sending', 'paused', 'completed', 'failed'],
    description: 'Campaign status',
    required: false,
  })
  @IsOptional()
  @IsEnum(['queued', 'scheduled', 'sending', 'paused', 'completed', 'failed'])
  status?: 'queued' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed';
}
