import { IsString, IsOptional, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AbTestConfigDto, UsersFilterDto } from 'src/campaigns/dto/create-campaign.dto';

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

  @ApiProperty({
    enum: ['queued', 'scheduled', 'sending', 'paused', 'completed', 'failed'],
    description: 'Campaign status',
    required: false,
  })
  @IsOptional()
  @IsEnum(['queued', 'scheduled', 'sending', 'paused', 'completed', 'failed'])
  status?: 'queued' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed';

  @ApiProperty({ type: UsersFilterDto, required: false, description: 'Filters for users' })
  @IsOptional()
  @Type(() => UsersFilterDto)
  @ValidateNested()
  filters?: UsersFilterDto;

  @ApiProperty({ type: AbTestConfigDto, required: false, description: 'A/B test configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AbTestConfigDto)
  ab_test?: AbTestConfigDto;



}
