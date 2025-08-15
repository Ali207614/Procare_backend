import { Module } from '@nestjs/common';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { TemplatesController } from 'src/templates/templates.controller';
import { TemplatesService } from 'src/templates/templates.service';

@Module({
  imports: [PermissionsModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
