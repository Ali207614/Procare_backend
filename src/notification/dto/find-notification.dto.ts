import { IsOptional, IsBooleanString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindNotificationsDto {
    @ApiPropertyOptional({ description: 'O‘qilganmi?', example: 'false' })
    @IsOptional()
    @IsBooleanString()
    is_read?: string; // 'true' | 'false'

    @ApiPropertyOptional({ description: 'Sahifa raqami', example: '1' })
    @IsOptional()
    @IsNumberString()
    page?: string;

    @ApiPropertyOptional({ description: 'Sahifadagi elementlar soni', example: '20' })
    @IsOptional()
    @IsNumberString()
    limit?: string;
}
