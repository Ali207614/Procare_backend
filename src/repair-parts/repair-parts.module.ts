import { Module } from '@nestjs/common';
import { RepairPartsService } from './repair-parts.service';
import { RepairPartsController } from './repair-parts.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  controllers: [RepairPartsController],
  providers: [RepairPartsService],
})
export class RepairPartsModule {}
