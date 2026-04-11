import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { RepairOrderRegion } from 'src/common/types/repair-order-region.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { CreateRepairOrderRegionDto } from './dto/create-repair-order-region.dto';
import { FindAllRepairOrderRegionsDto } from './dto/find-all-repair-order-regions.dto';
import { UpdateRepairOrderRegionDto } from './dto/update-repair-order-region.dto';
import { RepairOrderRegionsService } from './repair-order-regions.service';

@ApiTags('Repair Order Regions')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-order-regions')
export class RepairOrderRegionsController {
  constructor(private readonly service: RepairOrderRegionsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @UseInterceptors(PaginationInterceptor)
  @SetPermissions('repair.order.region.view')
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOperation({ summary: 'Get repair order regions with pagination and filtering' })
  getAll(
    @Query() query: FindAllRepairOrderRegionsDto,
  ): Promise<PaginationResult<RepairOrderRegion>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.region.view')
  @ApiOperation({ summary: 'Get a single repair order region by ID' })
  @ApiParam({ name: 'id', description: 'Repair order region ID (UUID)' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RepairOrderRegion> {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.region.create')
  @ApiOperation({ summary: 'Create a new repair order region' })
  @ApiResponse({ status: 201, description: 'Repair order region created successfully' })
  create(@Body() dto: CreateRepairOrderRegionDto): Promise<RepairOrderRegion> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.region.update')
  @ApiOperation({ summary: 'Update repair order region details' })
  @ApiParam({ name: 'id', description: 'Repair order region ID (UUID)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepairOrderRegionDto,
  ): Promise<{ message: string }> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.region.delete')
  @ApiOperation({ summary: 'Delete a repair order region' })
  @ApiParam({ name: 'id', description: 'Repair order region ID (UUID)' })
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.service.delete(id);
  }
}
