import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { CouriersService } from './couriers.service';
import { CourierQueryDto } from './dto/courier-query.dto';
import { Courier } from 'src/common/types/courier.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';

@ApiTags('Couriers')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('couriers')
export class CouriersController {
  constructor(private readonly service: CouriersService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @UseGuards(BranchExistGuard)
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'branch_id', required: true, type: String })
  @ApiOperation({ summary: 'Get list of couriers' })
  async findCouriers(@Query() query: CourierQueryDto): Promise<PaginationResult<Courier>> {
    return this.service.findAll(query);
  }
}
