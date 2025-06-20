/*
https://docs.nestjs.com/controllers#controllers
*/

import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { FindRentalPhoneDevicesDto } from './dto/find-rental-phone-devices.dto';
import { RentalPhoneDevicesService } from './rental-phone-devices.service';

@Controller()
export class RentalPhoneDevicesController {

    constructor(private readonly rentalPhoneDevicesService: RentalPhoneDevicesService) { }

    @Get()
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'sortBy', required: false, enum: ['sort', 'created_at'] })
    @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
    async findAll(@Query() dto: FindRentalPhoneDevicesDto) {
        return this.rentalPhoneDevicesService.findAll(dto);
    }

}
