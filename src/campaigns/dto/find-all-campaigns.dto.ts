import { IsOptional, IsEnum, IsString, MaxLength, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from './pagination-query.dto';

export enum CampaignStatus {
  Queued = 'queued',
  Scheduled = 'scheduled',
  Sending = 'sending',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Canceled = 'canceled',
}

export enum CampaignSendType {
  Now = 'now',
  Schedule = 'schedule',
}

export enum CampaignDeliveryMethod {
  Bot = 'bot',
  App = 'app',
  Sms = 'sms',
}

export class FindAllCampaignsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CampaignStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ enum: CampaignSendType, description: 'Filter by send type' })
  @IsOptional()
  @IsEnum(CampaignSendType)
  send_type?: CampaignSendType;

  @ApiPropertyOptional({ enum: CampaignDeliveryMethod, description: 'Filter by delivery method' })
  @IsOptional()
  @IsEnum(CampaignDeliveryMethod)
  delivery_method?: CampaignDeliveryMethod;

  @ApiPropertyOptional({ description: 'Filter by template ID (UUID)' })
  @IsOptional()
  @IsUUID()
  template_id?: string;

  @ApiPropertyOptional({
    description: 'Filter campaigns scheduled after this date',
    example: '2025-09-01',
  })
  @IsOptional()
  @IsDateString()
  schedule_from?: string;

  @ApiPropertyOptional({
    description: 'Filter campaigns scheduled before this date',
    example: '2025-09-30',
  })
  @IsOptional()
  @IsDateString()
  schedule_to?: string;

  @ApiPropertyOptional({ description: 'Search by template name or description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
