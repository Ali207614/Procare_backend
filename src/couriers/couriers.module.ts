import { CouriersController } from './couriers.controller';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { CouriersService } from './couriers.service';

@Module({
    imports: [],
    controllers: [
        CouriersController,],
    providers: [CouriersService],
})
export class CouriersModule { }
