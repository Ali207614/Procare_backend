import { IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRepairOrderSortDto {
    @ApiProperty({ example: 10 })
    @IsNumber({}, { context: { location: 'sort' } })
    @Min(0)
    @Max(9999)
    sort: number;
}
