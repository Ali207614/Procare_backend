import { Module } from '@nestjs/common';
import { RepairPartsService } from './repair-parts.service';
import { RepairPartsController } from './repair-parts.controller';

@Module({
  imports: [],
  controllers: [RepairPartsController],
  providers: [RepairPartsService],
})
export class RepairPartsModule {}
