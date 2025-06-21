import { UsersService } from './users.service';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { SapModule } from 'src/sap/sap.module';

@Module({
    imports: [PermissionsModule, SapModule],
    controllers: [UsersController],
    providers: [
        UsersService,],
})
export class UsersModule { }
