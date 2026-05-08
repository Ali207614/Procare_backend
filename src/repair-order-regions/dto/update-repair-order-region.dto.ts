import { PartialType } from '@nestjs/swagger';
import { CreateRepairOrderRegionDto } from './create-repair-order-region.dto';

export class UpdateRepairOrderRegionDto extends PartialType(CreateRepairOrderRegionDto) {}
