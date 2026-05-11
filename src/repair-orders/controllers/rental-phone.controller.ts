import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponseOptions,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderRentalPhone } from 'src/common/types/repair-order-rental-phone.interface';
import { CreateOrUpdateRentalPhoneDto } from '../dto/create-or-update-rental-phone.dto';
import {
  RentalPhoneMessageResponseDto,
  RepairOrderRentalPhoneDto,
} from '../dto/rental-phone-response.dto';
import { UpdateRentalPhoneDto } from '../dto/update-rental-phone.dto';
import { RentalPhoneUpdaterService } from '../services/rental-phone-updater.service';

const REPAIR_ORDER_ID_EXAMPLE = '7c54c7bd-c01e-4e95-ae70-c88283f61f2b';
const RENTAL_PHONE_RECORD_ID_EXAMPLE = 'a546eec5-5384-43f2-9fd5-ff09db2e7af2';
const RENTAL_PHONE_DEVICE_ID_EXAMPLE = 'b8b3db3b-19b5-4f31-a1f5-91e6d4bca2f4';
const RENTAL_PHONE_BASE_PATH = `/api/v1/repair-orders/${REPAIR_ORDER_ID_EXAMPLE}/rental-phone`;
const RENTAL_PHONE_RECORD_PATH = `${RENTAL_PHONE_BASE_PATH}/${RENTAL_PHONE_RECORD_ID_EXAMPLE}`;

type ErrorExample = {
  summary: string;
  message: string;
  location: string | null;
  error?: string;
  path?: string;
};

function errorResponseSchema(
  statusCode: number,
  message: string,
  error: string,
  location: string | null,
  path: string,
): SchemaObject {
  return {
    type: 'object',
    required: ['statusCode', 'message', 'error', 'location', 'timestamp', 'path'],
    properties: {
      statusCode: { type: 'number', example: statusCode },
      message: { type: 'string', example: message },
      error: { type: 'string', example: error },
      location: {
        type: 'string',
        nullable: true,
        description:
          'Stable frontend localization key. Rental phone endpoints use unique keys for distinct business failures.',
        example: location,
      },
      timestamp: { type: 'string', format: 'date-time', example: '2026-05-10T09:00:00.000Z' },
      path: { type: 'string', example: path },
    },
  };
}

function errorResponseContent(
  statusCode: number,
  defaultError: string,
  examples: ErrorExample[],
): ApiResponseOptions {
  const first = examples[0];

  return {
    content: {
      'application/json': {
        schema: errorResponseSchema(
          statusCode,
          first.message,
          first.error ?? defaultError,
          first.location,
          first.path ?? RENTAL_PHONE_BASE_PATH,
        ),
        examples: Object.fromEntries(
          examples.map((example) => [
            example.location ?? example.summary.toLowerCase().replace(/\s+/g, '_'),
            {
              summary: example.summary,
              value: {
                statusCode,
                message: example.message,
                error: example.error ?? defaultError,
                location: example.location,
                timestamp: '2026-05-10T09:00:00.000Z',
                path: example.path ?? RENTAL_PHONE_BASE_PATH,
              },
            },
          ]),
        ),
      },
    },
  };
}

const unauthorizedResponse = {
  description: 'Bearer token is missing, expired, or invalid.',
  ...errorResponseContent(401, 'UnauthorizedException', [
    {
      summary: 'Unauthorized',
      message: 'Unauthorized',
      location: null,
      path: RENTAL_PHONE_BASE_PATH,
    },
  ]),
};

const forbiddenResponse = {
  description:
    'The authenticated admin does not have rental phone management permission for the repair order branch and current status.',
  ...errorResponseContent(403, 'ForbiddenException', [
    {
      summary: 'Missing rental phone management permission',
      message: "Ushbu amalni bajarish uchun sizda yetarli ruxsat yo'q.",
      location: 'repair_order_delivery',
      path: RENTAL_PHONE_BASE_PATH,
    },
  ]),
};

@ApiTags('Repair Orders Rental Phone')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders/:repair_order_id/rental-phone')
export class RentalPhoneController {
  constructor(private readonly rentalPhoneUpdater: RentalPhoneUpdaterService) {}

  @Post()
  @ApiOperation({
    summary: 'Create repair-order rental phone record',
    operationId: 'createRepairOrderRentalPhone',
    description: [
      'Creates a rental phone record for one repair order.',
      '',
      'Use `Pending` when the repair order should show a rental-phone intention but no physical device has been issued yet.',
      '',
      'Use `Active` when issuing a real device immediately. In that case `rental_phone_id`, `price`, `rented_at`, and `returned_at` are required, and the selected rental phone device must be available. The device is marked as `Rented` after creation.',
      '',
      'The repair order must exist, must not be completed or cancelled, and must not already have an active rental phone.',
      '',
      'Every business error returned by this endpoint has a unique `location` value for frontend localization.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'repair_order_id',
    description: 'Repair order UUID that will receive the rental phone record.',
    example: REPAIR_ORDER_ID_EXAMPLE,
  })
  @ApiBody({
    type: CreateOrUpdateRentalPhoneDto,
    description:
      'Rental phone lifecycle payload. `Pending` requires only `status`; `Active` requires device, price, and dates.',
    examples: {
      pending: {
        summary: 'Create pending rental phone intent',
        value: {
          status: 'Pending',
          notes: 'Customer may need a replacement phone after diagnostics.',
        },
      },
      active: {
        summary: 'Issue a rental phone immediately',
        value: {
          status: 'Active',
          rental_phone_id: RENTAL_PHONE_DEVICE_ID_EXAMPLE,
          imei: '356938035643809',
          is_free: false,
          price: 50000,
          currency: 'UZS',
          rented_at: '2026-05-10T09:00:00.000Z',
          returned_at: '2026-05-13T09:00:00.000Z',
          notes: 'Temporary replacement phone issued during diagnostics.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Rental phone record created. `toggle` is true only for Pending records so the frontend can render the pending state directly.',
    type: RepairOrderRentalPhoneDto,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failure, missing repair order, duplicate active rental, closed repair order, or unavailable rental phone device.',
    ...errorResponseContent(400, 'BadRequestException', [
      {
        summary: 'Repair order not found',
        message: 'Repair order not found',
        location: 'rental_phone_create_repair_order_not_found',
      },
      {
        summary: 'Rental phone already active',
        message: 'Rental phone already assigned to this repair order',
        location: 'rental_phone_create_already_assigned',
      },
      {
        summary: 'Repair order closed',
        message: 'Cannot assign rental phone to a completed repair order',
        location: 'rental_phone_create_order_closed',
      },
      {
        summary: 'Device unavailable',
        message: 'Rental phone not found',
        location: 'rental_phone_create_device_unavailable',
      },
      {
        summary: 'Invalid repair order id format',
        message: 'Invalid UUID format',
        error: 'BadRequestException',
        location: 'repair_order_id_format',
      },
      {
        summary: 'Active rental missing required device',
        message: 'rental_phone_id is required when status is Active',
        error: 'ValidationError',
        location: 'rental_phone_id_required',
      },
    ]),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse)
  @ApiForbiddenResponse(forbiddenResponse)
  async create(
    @Param('repair_order_id', new ParseUUIDPipe({ location: 'repair_order_id_format' }))
    orderId: string,
    @Body() dto: CreateOrUpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderRentalPhone> {
    return this.rentalPhoneUpdater.create(orderId, dto, admin);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update latest repair-order rental phone state',
    operationId: 'updateRepairOrderRentalPhoneState',
    description: [
      'Updates the latest rental phone record attached to the repair order.',
      '',
      'Supported workflow:',
      '- `Pending` can be promoted to `Active` only when `rental_phone_id`, `rented_at`, `returned_at`, and `price` are provided.',
      '- `Active` can move to `Returned` or `Cancelled`, which releases the physical rental phone device back to `Available`.',
      '- `Active` cannot move back to `Pending`.',
      '- `Returned` and `Cancelled` are terminal states and cannot be changed.',
      '',
      'A device already assigned to an active rental cannot be swapped through this endpoint; cancel and create a new rental instead.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'repair_order_id',
    description: 'Repair order UUID whose latest rental phone record should be updated.',
    example: REPAIR_ORDER_ID_EXAMPLE,
  })
  @ApiBody({
    type: CreateOrUpdateRentalPhoneDto,
    description:
      'Partial lifecycle payload for the latest rental phone record. Required fields depend on the requested status transition.',
    examples: {
      pendingToActive: {
        summary: 'Promote Pending to Active',
        value: {
          status: 'Active',
          rental_phone_id: RENTAL_PHONE_DEVICE_ID_EXAMPLE,
          price: 50000,
          currency: 'UZS',
          rented_at: '2026-05-10T09:00:00.000Z',
          returned_at: '2026-05-13T09:00:00.000Z',
        },
      },
      markReturned: {
        summary: 'Mark Active rental as Returned',
        value: {
          status: 'Returned',
          returned_at: '2026-05-12T15:30:00.000Z',
          notes: 'Phone returned in good condition.',
        },
      },
      updatePriceAndNotes: {
        summary: 'Update price and note without changing status',
        value: {
          status: 'Active',
          price: 75000,
          notes: 'Extended rental by one day.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Latest rental phone record updated successfully.',
    type: RentalPhoneMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failure, missing rental record, invalid lifecycle transition, missing transition fields, forbidden device swap, or unavailable selected device.',
    ...errorResponseContent(400, 'BadRequestException', [
      {
        summary: 'Repair order not found',
        message: 'Repair order not found',
        location: 'rental_phone_update_repair_order_not_found',
      },
      {
        summary: 'No rental phone record',
        message: 'No rental phone records found for this repair order',
        location: 'rental_phone_update_record_not_found',
      },
      {
        summary: 'Active cannot return to Pending',
        message: 'Status transition from Active to Pending is not allowed',
        location: 'rental_phone_update_active_to_pending',
      },
      {
        summary: 'Terminal status cannot change',
        message: 'Cannot change status once it is Returned',
        location: 'rental_phone_update_terminal_status',
      },
      {
        summary: 'Missing Active transition fields',
        message: 'Fields required for Active status transition: rental_phone_id, rented_at',
        location: 'rental_phone_update_activation_fields_required',
      },
      {
        summary: 'Device swap is not allowed',
        message: 'Cannot change rental phone after assignment. Please cancel and create again.',
        location: 'rental_phone_update_device_change_not_allowed',
      },
      {
        summary: 'Selected device unavailable',
        message: 'Selected rental phone is not found or not available',
        location: 'rental_phone_update_device_unavailable',
      },
    ]),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse)
  @ApiForbiddenResponse(forbiddenResponse)
  async update(
    @Param('repair_order_id', new ParseUUIDPipe({ location: 'repair_order_id_format' }))
    orderId: string,
    @Body() dto: CreateOrUpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.rentalPhoneUpdater.update(orderId, dto, admin);
  }

  @Delete()
  @ApiOperation({
    summary: 'Cancel active repair-order rental phone',
    operationId: 'cancelRepairOrderRentalPhone',
    description: [
      'Cancels the currently active rental phone for a repair order.',
      '',
      'The rental phone record is not deleted; its status becomes `Cancelled`, `marked_as_cancelled_by` is set to the current admin, and the linked rental phone device is released back to `Available`.',
      '',
      'Use this endpoint for cancelling the active assignment. Use `DELETE /repair-orders/{repair_order_id}/rental-phone/{rental_phone_id}` only when the specific record should be physically removed.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'repair_order_id',
    description: 'Repair order UUID whose active rental phone should be cancelled.',
    example: REPAIR_ORDER_ID_EXAMPLE,
  })
  @ApiOkResponse({
    description: 'Active rental phone cancelled and its device released.',
    type: RentalPhoneMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid repair order id, missing repair order, or no active rental phone exists.',
    ...errorResponseContent(400, 'BadRequestException', [
      {
        summary: 'Repair order not found',
        message: 'Repair order not found',
        location: 'rental_phone_cancel_repair_order_not_found',
      },
      {
        summary: 'No active rental phone',
        message: 'No active rental phone found for this repair order',
        location: 'rental_phone_cancel_active_not_found',
      },
      {
        summary: 'Invalid repair order id format',
        message: 'Invalid UUID format',
        location: 'repair_order_id_format',
      },
    ]),
  })
  @ApiUnauthorizedResponse(unauthorizedResponse)
  @ApiForbiddenResponse(forbiddenResponse)
  async delete(
    @Param('repair_order_id', new ParseUUIDPipe({ location: 'repair_order_id_format' }))
    orderId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    await this.rentalPhoneUpdater.delete(orderId, admin);
    return { message: 'Rental phone cancelled' };
  }

  @Patch(':rental_phone_id')
  @ApiOperation({
    summary: 'Update a specific rental phone record',
    operationId: 'updateRepairOrderRentalPhoneRecord',
    description: [
      'Updates selected mutable fields on one rental phone record by its record UUID.',
      '',
      'This endpoint is intended for precise record-level corrections such as changing `is_free`, adjusting `rental_price`, or replacing the linked device on a known rental record.',
      '',
      'When `rental_phone_device_id` changes, the previous device is marked `Available` and the new device is marked `Rented`.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'repair_order_id',
    description: 'Repair order UUID that owns the rental phone record.',
    example: REPAIR_ORDER_ID_EXAMPLE,
  })
  @ApiParam({
    name: 'rental_phone_id',
    description: 'Repair-order rental phone record UUID to update.',
    example: RENTAL_PHONE_RECORD_ID_EXAMPLE,
  })
  @ApiBody({
    type: UpdateRentalPhoneDto,
    description: 'Record-level fields that can be corrected for a known rental phone record.',
    examples: {
      updatePricing: {
        summary: 'Update pricing',
        value: {
          is_free: false,
          rental_price: 75000,
          price_per_day: 25000,
        },
      },
      replaceDevice: {
        summary: 'Replace linked rental device',
        value: {
          rental_phone_device_id: RENTAL_PHONE_DEVICE_ID_EXAMPLE,
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Specific rental phone record updated successfully.',
    type: RepairOrderRentalPhoneDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid params, validation failure, or no mutable fields were provided.',
    ...errorResponseContent(400, 'BadRequestException', [
      {
        summary: 'Invalid repair order id format',
        message: 'Invalid UUID format',
        location: 'repair_order_id_format',
        path: RENTAL_PHONE_RECORD_PATH,
      },
      {
        summary: 'Invalid rental phone record id format',
        message: 'Invalid UUID format',
        location: 'rental_phone_record_id_format',
        path: RENTAL_PHONE_RECORD_PATH,
      },
      {
        summary: 'No valid fields',
        message: 'No valid fields to update',
        location: 'rental_phone_record_update_no_fields',
        path: RENTAL_PHONE_RECORD_PATH,
      },
    ]),
  })
  @ApiUnauthorizedResponse({
    ...unauthorizedResponse,
    content: errorResponseContent(401, 'UnauthorizedException', [
      {
        summary: 'Unauthorized',
        message: 'Unauthorized',
        location: null,
        path: RENTAL_PHONE_RECORD_PATH,
      },
    ]).content,
  })
  @ApiForbiddenResponse({
    ...forbiddenResponse,
    content: errorResponseContent(403, 'ForbiddenException', [
      {
        summary: 'Missing rental phone management permission',
        message: "Ushbu amalni bajarish uchun sizda yetarli ruxsat yo'q.",
        location: 'repair_order_delivery',
        path: RENTAL_PHONE_RECORD_PATH,
      },
    ]).content,
  })
  @ApiNotFoundResponse({
    description: 'Repair order or rental phone record was not found.',
    ...errorResponseContent(404, 'NotFound', [
      {
        summary: 'Repair order not found',
        message: 'Repair order not found',
        location: 'rental_phone_record_update_repair_order_not_found',
        path: RENTAL_PHONE_RECORD_PATH,
      },
      {
        summary: 'Rental phone record not found',
        message: 'Rental phone not found',
        location: 'rental_phone_record_update_not_found',
        path: RENTAL_PHONE_RECORD_PATH,
      },
    ]),
  })
  async updateRentalPhone(
    @Param('repair_order_id', new ParseUUIDPipe({ location: 'repair_order_id_format' }))
    repairOrderId: string,
    @Param('rental_phone_id', new ParseUUIDPipe({ location: 'rental_phone_record_id_format' }))
    rentalPhoneId: string,
    @Body() updateDto: UpdateRentalPhoneDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<RepairOrderRentalPhone> {
    return this.rentalPhoneUpdater.updateRentalPhone(
      repairOrderId,
      rentalPhoneId,
      updateDto,
      admin,
    );
  }

  @Delete(':rental_phone_id')
  @ApiOperation({
    summary: 'Delete a specific rental phone record',
    operationId: 'deleteRepairOrderRentalPhoneRecord',
    description: [
      'Physically deletes one rental phone record from the repair order and releases the linked rental phone device back to `Available`.',
      '',
      'Prefer `DELETE /repair-orders/{repair_order_id}/rental-phone` for normal active-rental cancellation because it preserves the rental record with `Cancelled` status.',
    ].join('\n'),
  })
  @ApiParam({
    name: 'repair_order_id',
    description: 'Repair order UUID that owns the rental phone record.',
    example: REPAIR_ORDER_ID_EXAMPLE,
  })
  @ApiParam({
    name: 'rental_phone_id',
    description: 'Repair-order rental phone record UUID to delete.',
    example: RENTAL_PHONE_RECORD_ID_EXAMPLE,
  })
  @ApiOkResponse({
    description: 'Specific rental phone record deleted and linked device released.',
    type: RentalPhoneMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'One of the route params is not a valid UUID.',
    ...errorResponseContent(400, 'BadRequestException', [
      {
        summary: 'Invalid repair order id format',
        message: 'Invalid UUID format',
        location: 'repair_order_id_format',
        path: RENTAL_PHONE_RECORD_PATH,
      },
      {
        summary: 'Invalid rental phone record id format',
        message: 'Invalid UUID format',
        location: 'rental_phone_record_id_format',
        path: RENTAL_PHONE_RECORD_PATH,
      },
    ]),
  })
  @ApiUnauthorizedResponse({
    ...unauthorizedResponse,
    content: errorResponseContent(401, 'UnauthorizedException', [
      {
        summary: 'Unauthorized',
        message: 'Unauthorized',
        location: null,
        path: RENTAL_PHONE_RECORD_PATH,
      },
    ]).content,
  })
  @ApiForbiddenResponse({
    ...forbiddenResponse,
    content: errorResponseContent(403, 'ForbiddenException', [
      {
        summary: 'Missing rental phone management permission',
        message: "Ushbu amalni bajarish uchun sizda yetarli ruxsat yo'q.",
        location: 'repair_order_delivery',
        path: RENTAL_PHONE_RECORD_PATH,
      },
    ]).content,
  })
  @ApiNotFoundResponse({
    description: 'Repair order or rental phone record was not found.',
    ...errorResponseContent(404, 'NotFound', [
      {
        summary: 'Repair order not found',
        message: 'Repair order not found',
        location: 'rental_phone_record_delete_repair_order_not_found',
        path: RENTAL_PHONE_RECORD_PATH,
      },
      {
        summary: 'Rental phone record not found',
        message: 'Rental phone not found',
        location: 'rental_phone_record_delete_not_found',
        path: RENTAL_PHONE_RECORD_PATH,
      },
    ]),
  })
  async removeRentalPhone(
    @Param('repair_order_id', new ParseUUIDPipe({ location: 'repair_order_id_format' }))
    repairOrderId: string,
    @Param('rental_phone_id', new ParseUUIDPipe({ location: 'rental_phone_record_id_format' }))
    rentalPhoneId: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.rentalPhoneUpdater.removeRentalPhone(repairOrderId, rentalPhoneId, admin);
  }
}
