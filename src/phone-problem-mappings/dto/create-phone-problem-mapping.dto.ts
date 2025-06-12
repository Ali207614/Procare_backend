import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreatePhoneProblemMappingDto {
    @ApiProperty({ example: 'uuid', description: 'Phone category ID' })
    @IsUUID()
    phone_category_id: string;

    @ApiProperty({ example: 'uuid', description: 'Problem category ID' })
    @IsUUID()
    problem_category_id: string;
}