import { PartialType } from '@nestjs/swagger';
import { CreateRepairOrderRejectCauseDto } from './create-repair-order-reject-cause.dto';

export class UpdateRepairOrderRejectCauseDto extends PartialType(CreateRepairOrderRejectCauseDto) {}
