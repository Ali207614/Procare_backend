import { IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationQueryDto } from './pagination-query.dto';

export class FindAllCampaignsDto extends PaginationQueryDto {
  @ApiProperty({
    enum: ['queued', 'scheduled', 'sending', 'paused', 'completed', 'failed'],
    description: 'Campaign status',
    required: false,
  })
  @IsOptional()
  @IsEnum(['queued', 'scheduled', 'sending', 'paused', 'completed', 'failed'])
  status?: string;
}
