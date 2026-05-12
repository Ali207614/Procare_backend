import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import {
  ServiceFormsService,
  WarrantyAgreementGenerationEvent,
} from '../services/service-forms.service';
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

  @Sse('service-forms/:repair_order_id/warranty-agreement')
  @ApiOperation({
    summary: 'Generate a warranty agreement PDF as a Server-Sent Events stream',
    description:
      'Streams generation states and finishes with a presigned URL for the generated warranty agreement PDF.',
  })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order UUID' })
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description: 'SSE stream with generation progress and final warranty agreement result',
    schema: {
      type: 'string',
      example:
        'event: completed\n' +
        'data: {"success":true,"data":{"state":"completed","message":"Warranty agreement generated successfully","result":{"warranty_id":"SF-A3B9K2","url":"https://storage.procare.uz/warranty-agreements/...","message":"Warranty agreement generated successfully"}}}\n\n',
    },
  })
  @ApiResponse({ status: 404, description: 'Repair order not found' })
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no')
  createWarrantyAgreementStream(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const emitProgress = (event: WarrantyAgreementGenerationEvent): void => {
        if (subscriber.closed) return;

        subscriber.next({
          type: event.state,
          data: {
            success: true,
            data: event,
          },
        });
      };

      void (async () => {
        try {
          await this.serviceFormsService.createWarrantyAgreement(
            repairOrderId,
            admin,
            emitProgress,
          );

          if (!subscriber.closed) {
            subscriber.complete();
          }
        } catch (error) {
          if (!subscriber.closed) {
            subscriber.next(this.toWarrantyAgreementErrorEvent(error));
            subscriber.complete();
          }
        }
      })();
    });
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

  private toWarrantyAgreementErrorEvent(error: unknown): MessageEvent {
    const response = error instanceof HttpException ? error.getResponse() : null;
    const statusCode = error instanceof HttpException ? error.getStatus() : 500;
    const responseObject =
      typeof response === 'object' && response !== null
        ? (response as Record<string, unknown>)
        : undefined;
    const message =
      typeof response === 'string'
        ? response
        : typeof responseObject?.message === 'string'
          ? responseObject.message
          : error instanceof Error
            ? error.message
            : 'Unexpected error';
    const errorName =
      typeof responseObject?.error === 'string'
        ? responseObject.error
        : error instanceof HttpException
          ? error.name
          : 'InternalServerError';

    return {
      type: 'failed',
      data: {
        success: false,
        data: {
          state: 'failed',
          message,
        },
        statusCode,
        message,
        error: errorName,
        location: typeof responseObject?.location === 'string' ? responseObject.location : null,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
