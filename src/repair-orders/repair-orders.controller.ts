import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Req,
  Query,
  Delete,
} from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';
import { RepairOrderStatusExistGuard } from 'src/common/guards/repair-order-status-exist.guard';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { MoveRepairOrderDto } from './dto/move-repair-order.dto';
import { UpdateRepairOrderSortDto } from './dto/update-repair-order-sort.dto';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';
import {
  FreshRepairOrder,
  RepairOrder,
  RepairOrderDetails,
  ViewableRepairOrdersResponse,
} from 'src/common/types/repair-order.interface';
import { FindAllRepairOrdersQueryDto } from 'src/repair-orders/dto/find-all-repair-orders.dto';
import { FindAllUnfilteredRepairOrdersDto } from 'src/repair-orders/dto/find-all-unfiltered-repair-orders.dto';
import { OpenRepairOrderApplicationDto } from 'src/repair-orders/dto/open-repair-order-application.dto';
import { UpdateClientInfoDto, UpdateProductDto, UpdateProblemDto, TransferBranchDto } from './dto';
import {
  RepairOrderDetailsSwaggerDto,
  RepairOrderListItemSwaggerDto,
} from './dto/repair-order-swagger.dto';
import { PaginationResult } from 'src/common/utils/pagination.util';

@ApiTags('Repair Orders')
@Controller('repair-orders/open')
export class OpenRepairOrdersController {
  constructor(private readonly service: RepairOrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create public repair order application',
    operationId: 'createOpenRepairOrderApplication',
    description: [
      'Public endpoint used by the website/app lead form.',
      '',
      'Auth: no admin bearer token is required.',
      '',
      'Backend behavior:',
      '- creates or reuses a customer by phone number;',
      '- normalizes Uzbekistan phone numbers to +998XXXXXXXXX;',
      '- creates the repair order in the configured public branch;',
      '- assigns the default active Open repair-order status;',
      '- sets priority to Medium, pickup_method to Self, delivery_method to Self, and source to Web;',
      '- returns the created repair_orders row, not the detailed admin view.',
    ].join('\n'),
  })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({
    type: OpenRepairOrderApplicationDto,
    description:
      'Send only name, phone_number, phone_category, and description. All four fields are required. Extra fields are rejected by the global validation pipe.',
    examples: {
      existingPhoneCategory: {
        summary: 'Known phone category UUID',
        description:
          'Use this when the frontend has a selectable active leaf phone category from the catalog.',
        value: {
          name: 'Asilbek Azimov',
          phone_number: '+998901234567',
          phone_category: '550e8400-e29b-41d4-a716-446655440000',
          description: 'Screen is broken and the battery drains quickly.',
        },
      },
      customPhoneCategory: {
        summary: 'Free text phone model',
        description:
          'Use this when the frontend lets the customer type a device/model. The backend appends this text to description and leaves phone_category_id empty.',
        value: {
          name: 'Asilbek Azimov',
          phone_number: '901234567',
          phone_category: 'iPhone 13 Pro',
          description: 'Display cracked after a drop.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Repair order created successfully. The response is the raw repair_orders record, not the detailed admin view.',
    schema: {
      type: 'object',
      required: [
        'id',
        'number_id',
        'branch_id',
        'status_id',
        'delivery_method',
        'pickup_method',
        'sort',
        'priority',
        'status',
        'phone_number',
        'source',
        'created_at',
        'updated_at',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        number_id: { type: 'number', example: 1024 },
        user_id: { type: 'string', format: 'uuid', nullable: true },
        branch_id: { type: 'string', format: 'uuid' },
        total: { type: 'string', example: '0.00' },
        imei: { type: 'string', nullable: true },
        phone_category_id: { type: 'string', format: 'uuid', nullable: true },
        status_id: { type: 'string', format: 'uuid' },
        delivery_method: { type: 'string', enum: ['Self', 'Delivery'], example: 'Self' },
        pickup_method: { type: 'string', enum: ['Self', 'Pickup'], example: 'Self' },
        sort: { type: 'number', example: 1 },
        priority: {
          type: 'string',
          enum: ['Low', 'Medium', 'High', 'Highest'],
          example: 'Medium',
        },
        priority_level: { type: 'number', example: 2 },
        agreed_date: { type: 'string', format: 'date-time', nullable: true },
        reject_cause_id: { type: 'string', format: 'uuid', nullable: true },
        region_id: { type: 'string', format: 'uuid', nullable: true },
        created_by: { type: 'string', format: 'uuid', nullable: true },
        status: {
          type: 'string',
          enum: ['Open', 'Deleted', 'Closed', 'Cancelled'],
          example: 'Open',
        },
        phone_number: { type: 'string', example: '+998901234567' },
        name: { type: 'string', nullable: true, example: 'Asilbek Azimov' },
        description: {
          type: 'string',
          nullable: true,
          example: 'Screen is broken and the battery drains quickly.',
        },
        source: { type: 'string', example: 'Web' },
        call_count: { type: 'number', example: 0 },
        missed_calls: { type: 'number', example: 0 },
        customer_no_answer_count: { type: 'number', example: 0 },
        last_customer_no_answer_at: { type: 'string', format: 'date-time', nullable: true },
        customer_no_answer_due_at: { type: 'string', format: 'date-time', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
      example: {
        id: '7c54c7bd-c01e-4e95-ae70-c88283f61f2b',
        number_id: 1024,
        user_id: '9583be3b-9e19-4b3d-a110-7ec44ce734f7',
        branch_id: '00000000-0000-4000-8000-000000000000',
        total: '0.00',
        imei: null,
        phone_category_id: null,
        status_id: '2a56dc59-7966-47a5-960a-9b7d3c8f9d99',
        delivery_method: 'Self',
        pickup_method: 'Self',
        sort: 1,
        priority: 'Medium',
        priority_level: 2,
        agreed_date: null,
        reject_cause_id: null,
        region_id: null,
        created_by: null,
        status: 'Open',
        phone_number: '+998901234567',
        name: 'Asilbek Azimov',
        description: 'Display cracked after a drop.\nPhone category: iPhone 13 Pro',
        source: 'Web',
        call_count: 0,
        missed_calls: 0,
        customer_no_answer_count: 0,
        last_customer_no_answer_at: null,
        customer_no_answer_due_at: null,
        created_at: '2026-04-28T10:30:00.000Z',
        updated_at: '2026-04-28T10:30:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Validation or master-data error. Frontend can use location to highlight the field.',
    schema: {
      oneOf: [
        {
          type: 'object',
          description: 'Business validation error from the repair order service.',
          properties: {
            statusCode: { type: 'number', example: 400 },
            message: { type: 'string', example: 'Phone number must be an Uzbekistan phone number' },
            error: { type: 'string', example: 'BadRequestException' },
            location: { type: 'string', example: 'phone_number' },
            timestamp: { type: 'string', format: 'date-time' },
            path: { type: 'string', example: '/api/v1/repair-orders/open' },
          },
        },
        {
          type: 'object',
          description: 'DTO validation error from the global validation pipe.',
          properties: {
            statusCode: { type: 'number', example: 400 },
            message: { type: 'string', example: 'property email should not exist' },
            error: { type: 'string', example: 'ValidationError' },
            location: { type: 'string', example: 'email' },
            timestamp: { type: 'string', format: 'date-time' },
            path: { type: 'string', example: '/api/v1/repair-orders/open' },
          },
        },
      ],
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error. Frontend should show a generic retry/support message.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Unexpected error' },
        error: { type: 'string', example: 'InternalServerError' },
        location: { type: 'string', nullable: true, example: null },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string', example: '/api/v1/repair-orders/open' },
      },
    },
  })
  createOpenApplication(@Body() dto: OpenRepairOrderApplicationDto): Promise<RepairOrder> {
    return this.service.createOpenApplication(dto);
  }
}

@ApiTags('Repair Orders')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@ApiExtraModels(RepairOrderListItemSwaggerDto, RepairOrderDetailsSwaggerDto)
@Controller('repair-orders')
export class RepairOrdersController {
  constructor(private readonly service: RepairOrdersService) {}

  @Post()
  @UseGuards(BranchExistGuard)
  @ApiOperation({ summary: 'Create repair order' })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRepairOrderDto,
  ): Promise<RepairOrder> {
    return this.service.create(req.admin, req.branch.id, dto);
  }

  @Patch(':repair_order_id')
  @ApiOperation({ summary: 'Update repair order' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  update(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateRepairOrderDto,
  ): Promise<{ message: string }> {
    return this.service.update(req.admin, repairOrderId, dto);
  }

  @Patch(':repair_order_id/take')
  @UseGuards(BranchExistGuard)
  @ApiOperation({ summary: 'Take a Mother Branch repair order into a child branch' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  take(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.service.take(repairOrderId, req.branch.id, req.admin);
  }

  @Get()
  @UseGuards(BranchExistGuard)
  @ApiOperation({
    summary: 'Get all repair orders by branchId (can_view only)',
    deprecated: true,
    description:
      'Deprecated. Use GET /api/v1/repair-orders/viewable for the same grouped payload wrapped in the standard meta/data response structure.',
  })
  @ApiOkResponse({
    description:
      'Repair orders grouped by status ID, including the total count of orders for each status',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          metrics: {
            type: 'object',
            properties: {
              total_repair_orders: { type: 'number' },
            },
          },
          repair_orders: {
            type: 'array',
            items: { $ref: getSchemaPath(RepairOrderListItemSwaggerDto) },
          },
        },
      },
    },
  })
  findAllByBranch(
    @Req() req: AuthenticatedRequest,
    @Query() query: FindAllRepairOrdersQueryDto,
  ): Promise<
    Record<string, { metrics: { total_repair_orders: number }; repair_orders: FreshRepairOrder[] }>
  > {
    return this.service.findAllByAdminBranch(req.admin, req.branch.id, query);
  }

  @Get('viewable')
  @UseGuards(BranchExistGuard)
  @ApiOperation({
    summary: 'Get viewable repair orders in the standard meta/data response structure',
    description:
      'Returns the same status-grouped repair order payload as GET /api/v1/repair-orders, but wrapped in { meta, data }. limit and offset are applied independently inside each status group. The search query parameter routes phone-like input to phone indexes and text/model input to customer name and phone category indexes.',
  })
  @ApiOkResponse({
    description:
      'Viewable repair orders grouped by status ID and wrapped in the standard meta/data structure.',
    schema: {
      type: 'object',
      properties: {
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 357 },
            limit: { type: 'number', example: 50 },
            offset: { type: 'number', example: 0 },
          },
        },
        data: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              metrics: {
                type: 'object',
                properties: {
                  total_repair_orders: { type: 'number', example: 13 },
                },
              },
              repair_orders: {
                type: 'array',
                items: { $ref: getSchemaPath(RepairOrderListItemSwaggerDto) },
              },
            },
          },
        },
      },
    },
  })
  findViewable(
    @Req() req: AuthenticatedRequest,
    @Query() query: FindAllRepairOrdersQueryDto,
  ): Promise<ViewableRepairOrdersResponse> {
    return this.service.findViewableByAdminBranch(req.admin, req.branch.id, query);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get all repair orders without status or branch filters (Super Admin only)',
  })
  findAllUnfiltered(
    @Req() req: AuthenticatedRequest,
    @Query() query: FindAllUnfilteredRepairOrdersDto,
  ): Promise<PaginationResult<RepairOrder>> {
    return this.service.findAllUnfiltered(req.admin, query);
  }

  @Get(':repair_order_id')
  @ApiOperation({ summary: 'Get repair order by ID (with permission)' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  @ApiOkResponse({
    description: 'Repair order details',
    type: RepairOrderDetailsSwaggerDto,
  })
  findOne(
    @Param('repair_order_id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RepairOrderDetails> {
    return this.service.findById(req.admin, id);
  }

  @Patch(':repair_order_id/move')
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Move repair order' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  move(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: MoveRepairOrderDto,
  ): Promise<{ message: string }> {
    return this.service.move(req.admin, repairOrderId, dto);
  }

  @Patch(':repair_order_id/sort')
  @ApiOperation({ summary: 'Update status sort order' })
  @ApiParam({ name: 'repair_order_id', description: 'Status ID (UUID)' })
  async updateSort(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() dto: UpdateRepairOrderSortDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.service.updateSort(repairOrderId, dto.sort, admin);
  }

  @Delete(':repair_order_id')
  @ApiOperation({ summary: 'Soft delete a repair order (with permission)' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  delete(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.service.softDelete(req.admin, repairOrderId);
  }

  @Patch(':repair_order_id/client')
  @ApiOperation({ summary: 'Update client information' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  updateClientInfo(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() updateClientDto: UpdateClientInfoDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.service.updateClientInfo(repairOrderId, updateClientDto, req.admin);
  }

  @Patch(':repair_order_id/product')
  @ApiOperation({ summary: 'Update product information' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  updateProduct(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() updateDto: UpdateProductDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.service.updateProduct(repairOrderId, updateDto, req.admin);
  }

  @Patch(':repair_order_id/problems/:problem_id')
  @ApiOperation({ summary: 'Update problem details' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  @ApiParam({ name: 'problem_id', description: 'Problem ID' })
  updateProblem(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('problem_id', ParseUUIDPipe) problemId: string,
    @Body() updateDto: UpdateProblemDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.service.updateProblem(repairOrderId, problemId, updateDto, req.admin);
  }

  @Patch(':repair_order_id/transfer-branch')
  @ApiOperation({ summary: 'Transfer repair order to different branch' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  transferBranch(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() transferDto: TransferBranchDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.service.transferBranch(repairOrderId, transferDto, req.admin);
  }
}
