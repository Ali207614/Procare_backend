import { Module } from '@nestjs/common';
import { PhoneProblemMappingsService } from './phone-problem-mappings.service';
import { PhoneProblemMappingsController } from './phone-problem-mappings.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
    imports: [PermissionsModule],
    controllers: [PhoneProblemMappingsController],
    providers: [PhoneProblemMappingsService],
})
export class PhoneProblemMappingsModule { }