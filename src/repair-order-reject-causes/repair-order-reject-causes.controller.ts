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
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { RepairOrderRejectCausesService } from './repair-order-reject-causes.service';
import { RepairOrderRejectCause } from 'src/common/types/repair-order-reject-cause.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { CreateRepairOrderRejectCauseDto } from './dto/create-repair-order-reject-cause.dto';
import { FindAllRepairOrderRejectCausesDto } from './dto/find-all-repair-order-reject-causes.dto';
import { UpdateRepairOrderRejectCauseDto } from './dto/update-repair-order-reject-cause.dto';
import { UpdateRepairOrderRejectCauseSortDto } from './dto/update-repair-order-reject-cause-sort.dto';

@ApiTags('Repair Order Reject Causes')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-order-reject-causes')
export class RepairOrderRejectCausesController {
  constructor(private readonly service: RepairOrderRejectCausesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @UseInterceptors(PaginationInterceptor)
  @SetPermissions('repair.order.reject.cause.view')
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOperation({ summary: 'Get reject causes with pagination and filtering' })
  async getAll(
    @Query() query: FindAllRepairOrderRejectCausesDto,
  ): Promise<PaginationResult<RepairOrderRejectCause>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.reject.cause.view')
  @ApiOperation({ summary: 'Get a single reject cause by ID' })
  @ApiParam({ name: 'id', description: 'Reject cause ID (UUID)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RepairOrderRejectCause> {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.reject.cause.create')
  @ApiOperation({ summary: 'Create a new reject cause' })
  @ApiResponse({ status: 201, description: 'Reject cause created successfully' })
  async create(
    @CurrentAdmin() admin: AdminPayload,
    @Body() dto: CreateRepairOrderRejectCauseDto,
  ): Promise<RepairOrderRejectCause> {
    return this.service.create(dto, admin.id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.reject.cause.update')
  @ApiOperation({ summary: 'Update reject cause details' })
  @ApiParam({ name: 'id', description: 'Reject cause ID (UUID)' })
  async update(
    @CurrentAdmin() admin: AdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepairOrderRejectCauseDto,
  ): Promise<{ message: string }> {
    return this.service.update(id, dto, admin.id);
  }

  @Patch(':id/sort')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.reject.cause.update')
  @ApiOperation({ summary: 'Update reject cause sort order' })
  @ApiParam({ name: 'id', description: 'Reject cause ID (UUID)' })
  async updateSort(
    @CurrentAdmin() admin: AdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepairOrderRejectCauseSortDto,
  ): Promise<{ message: string }> {
    return this.service.updateSort(id, dto.sort, admin.id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair.order.reject.cause.delete')
  @ApiOperation({ summary: 'Soft delete a reject cause' })
  @ApiParam({ name: 'id', description: 'Reject cause ID (UUID)' })
  async delete(
    @CurrentAdmin() admin: AdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.service.delete(id, admin.id);
  }
}
