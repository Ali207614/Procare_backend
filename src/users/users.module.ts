import { UsersService } from './users.service';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
    imports: [PermissionsModule],
    controllers: [UsersController],
    providers: [
        UsersService,],
})
export class UsersModule { }
