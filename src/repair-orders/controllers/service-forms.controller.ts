import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ServiceFormsService } from '../services/service-forms.service';
import { CreateServiceFormDto } from '../dto/create-service-form.dto';

@ApiTags('Repair Orders')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders')
export class ServiceFormsController {
  constructor(private readonly serviceFormsService: ServiceFormsService) {}

  @Post('service-forms/:repair_order_id')
  @ApiOperation({ summary: 'Generate a service form PDF and store it in MinIO' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order UUID' })
  createServiceForm(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() dto: CreateServiceFormDto,
  ): Promise<{ warranty_id: string; message: string }> {
    return this.serviceFormsService.createServiceForm(repairOrderId, dto);
  }

  @Get('service-forms/:repair_order_id')
  @ApiOperation({ summary: 'Get the latest service form warranty ID and PDF URL' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order UUID' })
  getServiceForm(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
  ): Promise<{ warranty_id: string; url: string }> {
    return this.serviceFormsService.getServiceForm(repairOrderId);
  }
}
