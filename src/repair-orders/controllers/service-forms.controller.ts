import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ServiceFormsService } from '../services/service-forms.service';
import { CreateServiceFormDto } from '../dto/create-service-form.dto';
import {
  CreateServiceFormResponseDto,
  GetServiceFormResponseDto,
} from '../dto/service-form-response.dto';

@ApiTags('Repair Orders')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders')
export class ServiceFormsController {
  constructor(private readonly serviceFormsService: ServiceFormsService) {}

  @Post('service-forms/:repair_order_id')
  @ApiOperation({ summary: 'Generate a service form PDF and store it in MinIO' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order UUID' })
  @ApiResponse({
    status: 201,
    description: 'Service form generated successfully',
    type: CreateServiceFormResponseDto,
  })
  @ApiResponse({ status: 400, description: 'IMEI is missing in repair order' })
  @ApiResponse({ status: 404, description: 'Repair order not found' })
  createServiceForm(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() dto: CreateServiceFormDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<CreateServiceFormResponseDto> {
    return this.serviceFormsService.createServiceForm(repairOrderId, dto, admin);
  }

  @Get('service-forms/:repair_order_id')
  @ApiOperation({ summary: 'Get the latest service form warranty ID and PDF URL' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order UUID' })
  @ApiResponse({ status: 200, description: 'Success', type: GetServiceFormResponseDto })
  getServiceForm(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
  ): Promise<GetServiceFormResponseDto | object> {
    return this.serviceFormsService.getServiceForm(repairOrderId);
  }
}
