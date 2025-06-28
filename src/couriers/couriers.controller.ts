/*
https://docs.nestjs.com/controllers#controllers
*/

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { CouriersService } from './couriers.service';
import { CourierQueryDto } from './dto/courier-query.dto';

@ApiTags('Couriers')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('couriers')
export class CouriersController {
  constructor(private readonly service: CouriersService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOperation({ summary: 'Get list of couriers' })
  async findCouriers(@Query() query: CourierQueryDto) {
    return this.service.findAll(query);
  }
}
