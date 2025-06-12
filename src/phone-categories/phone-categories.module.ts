import { Module } from '@nestjs/common';
import { PhoneCategoriesService } from './phone-categories.service';
import { PhoneCategoriesController } from './phone-categories.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
    imports: [PermissionsModule],
    controllers: [PhoneCategoriesController],
    providers: [PhoneCategoriesService],
})
export class PhoneCategoriesModule { }
