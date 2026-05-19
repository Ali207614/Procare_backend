import { Module } from '@nestjs/common';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { PdfModule } from 'src/pdf/pdf.module';
import { WarrantyDocumentsController } from './warranty-documents.controller';
import { WarrantyDocumentsService } from './warranty-documents.service';

@Module({
  imports: [PermissionsModule, PdfModule],
  controllers: [WarrantyDocumentsController],
  providers: [WarrantyDocumentsService],
  exports: [WarrantyDocumentsService],
})
export class WarrantyDocumentsModule {}
