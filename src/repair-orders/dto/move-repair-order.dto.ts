import { IsNumber, IsUUID, Max, Min } from "class-validator";

export class MoveRepairOrderDto {
    @IsUUID('all', { context: { location: 'status_id' } })
    status_id: string;

    @IsNumber({}, { context: { location: 'sort' } })
    @Min(0)
    @Max(9999)
    sort: number;
}
