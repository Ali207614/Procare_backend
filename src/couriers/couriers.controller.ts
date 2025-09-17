import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { CouriersService } from './couriers.service';
import { CourierQueryDto } from './dto/courier-query.dto';
import { Courier } from 'src/common/types/courier.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';

@ApiTags('Couriers')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('couriers')
export class CouriersController {
  constructor(private readonly service: CouriersService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOperation({ summary: 'Get list of couriers' })
  async findCouriers(@Query() query: CourierQueryDto): Promise<PaginationResult<Courier>> {
    return this.service.findAll(query);
  }
}
