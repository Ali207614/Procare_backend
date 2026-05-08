import { PartialType } from '@nestjs/swagger';
import { CreateRepairOrderStatusDto } from './create-repair-order-status.dto';

export class UpdateRepairOrderStatusDto extends PartialType(CreateRepairOrderStatusDto) {}
