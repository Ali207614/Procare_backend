import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { PdfModule } from 'src/pdf/pdf.module';

@Module({
  imports: [PermissionsModule, PdfModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
