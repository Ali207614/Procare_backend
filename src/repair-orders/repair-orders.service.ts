import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RedisService } from 'src/common/redis/redis.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { parseAgreedDateInput } from 'src/common/utils/agreed-date.util';
import {
  RepairOrder,
  RepairOrderDetails,
  FreshRepairOrder,
} from 'src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderChangeLoggerService } from 'src/repair-orders/services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from 'src/repair-orders/services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from 'src/repair-orders/services/final-problem-updater.service';
import { RepairOrderCreateHelperService } from 'src/repair-orders/services/repair-order-create-helper.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { CreateRepairOrderDto } from 'src/repair-orders/dto/create-repair-order.dto';
import { OpenRepairOrderApplicationDto } from 'src/repair-orders/dto/open-repair-order-application.dto';
import { UpdateRepairOrderDto } from 'src/repair-orders/dto/update-repair-order.dto';
import { MoveRepairOrderDto } from 'src/repair-orders/dto/move-repair-order.dto';
import { FindAllRepairOrdersQueryDto } from 'src/repair-orders/dto/find-all-repair-orders.dto';
import { FindAllUnfilteredRepairOrdersDto } from 'src/repair-orders/dto/find-all-unfiltered-repair-orders.dto';
import { UpdateClientInfoDto, UpdateProductDto, UpdateProblemDto, TransferBranchDto } from './dto';
import { PdfService } from 'src/pdf/pdf.service';
import { RepairOrderWebhookService } from 'src/repair-orders/services/repair-order-webhook.service';
import { NotificationService } from 'src/notification/notification.service';
import { HistoryService } from 'src/history/history.service';
import { RepairNotificationMeta } from 'src/common/types/notification.interface';
import { RepairOrderStatus } from 'src/common/types/repair-order-status.interface';
import { RepairOrderRegion } from 'src/common/types/repair-order-region.interface';
import { User } from 'src/common/types/user.interface';
import { formatUzPhoneToE164, getUzPhoneLookupCandidates } from 'src/common/utils/phone.util';
import { PaginationResult } from 'src/common/utils/pagination.util';

const SYSTEM_ADMIN_ID = '00000000-0000-4000-8000-000000000000';
const NO_ANSWER_REJECT_CAUSE_NAME = "Qo'ng'iroqqa javob bermadi";
const DEFAULT_OPEN_APPLICATION_BRANCH_ID = '00000000-0000-4000-8000-000000000000';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RepairOrderAssignmentSource = 'manual' | 'telephony_auto' | 'telephony_answered';
const ASSIGNMENT_SOURCE_TELEPHONY_AUTO: RepairOrderAssignmentSource = 'telephony_auto';
const ASSIGNMENT_SOURCE_TELEPHONY_ANSWERED: RepairOrderAssignmentSource = 'telephony_answered';
const AUTO_REPLACEABLE_ASSIGNMENT_SOURCES: RepairOrderAssignmentSource[] = [
  ASSIGNMENT_SOURCE_TELEPHONY_AUTO,
];

@Injectable()
export class RepairOrdersService {
  private readonly table = 'repair_orders';
  private readonly terminalStatusTypes = new Set(['Cancelled', 'Canceled', 'Completed', 'Invalid']);
  private readonly telephonyInvalidReuseWindowHours = 72;
  private readonly customerNoAnswerLimit = 3;
  private readonly customerNoAnswerDelayHours = 24;

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
    private readonly initialProblemUpdater: InitialProblemUpdaterService,
    private readonly finalProblemUpdater: FinalProblemUpdaterService,
    private readonly helper: RepairOrderCreateHelperService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
    private readonly pdfService: PdfService,
    private readonly webhookService: RepairOrderWebhookService,
    private readonly notificationService: NotificationService,
    private readonly historyService: HistoryService,
  ) {}

  async create(
    admin: AdminPayload,
    branchId: string,
    dto: CreateRepairOrderDto,
  ): Promise<RepairOrder> {
    const trx = await this.knex.transaction();
    try {
      const createStatus = await this.resolveCreateStatus(trx, branchId, dto.status_id);
      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, branchId);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        branchId,
        createStatus.id,
        ['can_add'],
        'repair_order_permission',
        permissions,
      );
      const createStatusPermission = permissions.find(
        (permission) =>
          permission.branch_id === branchId && permission.status_id === createStatus.id,
      );

      if (createStatusPermission?.cannot_continue_without_agreed_date && !dto.agreed_date) {
        throw new BadRequestException({
          message: 'Ushbu status uchun kelishilgan sana kiritilishi shart.',
          location: 'agreed_date',
        });
      }

      if (dto.agreed_date !== undefined && dto.agreed_date !== null) {
        this.validateAgreedDateOrThrow(dto.agreed_date);
      }

      // ── Resolve user: either by user_id or by inline client info ──
      let resolvedUserId: string | undefined = dto.user_id;
      let resolvedPhoneNumber = this.normalizePhoneNumber(dto.phone_number || dto.phone || '');
      let resolvedName: string | null =
        dto.name || [dto.first_name, dto.last_name].filter(Boolean).join(' ') || null;
      const resolvedDescription = this.normalizeDescription(dto.description);
      const normalizedImei = dto.imei?.trim() || undefined;

      if (dto.user_id) {
        // Flow 1: existing user_id provided
        const user = await trx('users').where({ id: dto.user_id, status: 'Open' }).first();
        if (!user)
          throw new BadRequestException({
            message: 'User not found or inactive',
            location: 'user_id',
          });
        resolvedPhoneNumber = user.phone_number1 || '';
        resolvedName = [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
      } else if (resolvedPhoneNumber) {
        resolvedUserId =
          (await this.ensureUserByPhone(trx, resolvedPhoneNumber, {
            allowCreate: true,
            source: 'employee',
            createdBy: admin.id,
            phoneVerified: false,
            logContext: 'Manual User',
            name: resolvedName,
          })) ?? undefined;
      } else {
        throw new BadRequestException({
          message: 'Either user_id or phone_number must be provided',
          location: 'phone_number',
        });
      }

      const existingCustomerOrders = await this.findExistingCustomerRepairOrders(
        trx,
        resolvedUserId,
        resolvedPhoneNumber,
      );

      if (existingCustomerOrders.length && !dto.phone_category_id) {
        throw new BadRequestException({
          message: 'Mijozda avvalgi vazifalar mavjud bo‘lsa, telefon turi kiritilishi shart',
          location: 'phone_category_id',
        });
      }

      if (dto.phone_category_id) {
        const phoneCategory = await trx('phone_categories as pc')
          .select(
            'pc.*',
            this.knex.raw(
              `EXISTS (SELECT 1 FROM phone_categories c WHERE c.parent_id = pc.id AND c.status = 'Open') as has_children`,
            ),
          )
          .where({ 'pc.id': dto.phone_category_id, 'pc.is_active': true, 'pc.status': 'Open' })
          .first();
        if (!phoneCategory)
          throw new BadRequestException({
            message: 'Phone category not found or inactive',
            location: 'phone_category_id',
          });
        if (phoneCategory.has_children)
          throw new BadRequestException({
            message: 'Phone category must not have children',
            location: 'phone_category_id',
          });
      }

      if (dto.region_id) {
        await this.ensureRegionExists(trx, dto.region_id);
      }

      if (dto.phone_category_id) {
        this.ensureImeiForMatchingPhoneCategory(
          existingCustomerOrders,
          dto.phone_category_id,
          normalizedImei,
        );
      }

      const sort = 999999;
      const createdAt = dto.created_at
        ? new Date(dto.created_at).toISOString()
        : new Date().toISOString();
      const insertData: Partial<RepairOrder> = {
        user_id: resolvedUserId,
        branch_id: branchId,
        phone_category_id: dto.phone_category_id,
        region_id: dto.region_id,
        imei: normalizedImei,
        priority: dto.priority || 'Medium',
        status_id: createStatus.id,
        sort,
        delivery_method: 'Self',
        pickup_method: 'Self',
        created_by: admin.id,
        phone_number: resolvedPhoneNumber,
        name: resolvedName,
        description: resolvedDescription ?? null,
        agreed_date: dto.agreed_date ?? null,
        source: dto.source || 'Qolda',
        created_at: createdAt,
        updated_at: createdAt,
      };

      const [inserted]: RepairOrder[] = await trx(this.table).insert(insertData).returning('*');
      await this.moveToTop(trx, inserted);
      const order = inserted;

      // Process helpers (initial problems, comments, etc.) for the new order
      await Promise.all([
        this.helper.insertAssignAdmins(
          trx,
          dto,
          admin,
          order.status_id,
          order.id,
          order.branch_id,
          permissions,
        ),
        this.helper.insertRentalPhone(
          trx,
          dto,
          admin,
          order.status_id,
          order.id,
          order.branch_id,
          permissions,
        ),
        this.helper.insertInitialProblems(
          trx,
          dto,
          admin,
          order.status_id,
          order.id,
          order.branch_id,
          permissions,
        ),
        this.helper.insertFinalProblems(
          trx,
          dto,
          admin,
          order.status_id,
          order.id,
          order.branch_id,
          permissions,
        ),
        this.helper.insertComments(
          trx,
          dto,
          admin,
          order.status_id,
          order.id,
          order.branch_id,
          permissions,
        ),
        this.helper.insertPickup(
          trx,
          dto,
          admin,
          order.status_id,
          order.id,
          order.branch_id,
          permissions,
        ),
        this.helper.insertDelivery(
          trx,
          dto,
          admin,
          order.status_id,
          order.id,
          order.branch_id,
          permissions,
        ),
      ]);

      await trx.commit();

      // Notify all admins in the branch room and create DB records
      void this.notifyRepairOrderUpdate(order, {
        title: 'Yangi buyurtma',
        message: `Filialda yangi buyurtma yaratildi: #${order.number_id}`,
        action: 'order_created',
      });

      this.webhookService.sendWebhook(order.id).catch((err: unknown) => {
        this.logger.error(
          `[RepairOrdersService] Webhook error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      return order;
    } catch (err) {
      await trx.rollback();

      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(
        `Failed to handle repair order: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  async createOpenApplication(dto: OpenRepairOrderApplicationDto): Promise<RepairOrder> {
    const trx = await this.knex.transaction();
    try {
      const branchId = await this.resolveOpenApplicationBranchId(trx);
      const createStatus = await this.resolveCreateStatus(trx, branchId);
      const normalizedPhoneNumber = this.normalizeOpenApplicationPhoneNumber(dto.phone_number);
      const resolvedName = this.parseCustomerNameOrThrow(dto.name).fullName;
      const phoneCategory = await this.resolveOpenApplicationPhoneCategory(trx, dto.phone_category);
      const description = this.buildOpenApplicationDescription(
        dto.description,
        phoneCategory.customText,
      );

      const resolvedUserId = await this.ensureUserByPhone(trx, normalizedPhoneNumber, {
        allowCreate: true,
        source: 'web',
        createdBy: null,
        phoneVerified: false,
        logContext: 'Open Application User',
        name: resolvedName,
      });

      const createdAt = new Date().toISOString();
      const [inserted]: RepairOrder[] = await trx<RepairOrder>(this.table)
        .insert({
          user_id: resolvedUserId,
          branch_id: branchId,
          phone_category_id: phoneCategory.id,
          priority: 'Medium',
          status_id: createStatus.id,
          sort: 999999,
          delivery_method: 'Self',
          pickup_method: 'Self',
          created_by: null,
          phone_number: normalizedPhoneNumber,
          name: resolvedName,
          description,
          source: 'Web',
          created_at: createdAt,
          updated_at: createdAt,
        })
        .returning('*');

      await this.moveToTop(trx, inserted);
      const assignedAdminId = await this.assignFallbackAdminIfOrderHasNone(
        trx,
        inserted.id,
        branchId,
      );
      await this.recordOpenApplicationHistory(trx, inserted, resolvedUserId, resolvedName);
      await trx.commit();

      void this.notifyRepairOrderUpdate(inserted, {
        title: 'Yangi buyurtma',
        message: `Saytdan yangi buyurtma yaratildi: #${inserted.number_id}`,
        action: 'order_created',
        targetAdminId: assignedAdminId,
      });

      this.webhookService.sendWebhook(inserted.id).catch((err: unknown) => {
        this.logger.error(
          `[RepairOrdersService] Webhook error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

      await this.redisService.flushByPrefix(`${this.table}:${inserted.branch_id}`);
      return inserted;
    } catch (err) {
      await trx.rollback();

      if (err instanceof HttpException) {
        throw err;
      }

      this.logger.error(
        `Failed to create open repair order application: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }
  }

  private async resolveCreateStatus(
    trx: Knex.Transaction,
    branchId: string,
    statusId?: string,
  ): Promise<RepairOrderStatus> {
    if (statusId) {
      const status = await trx<RepairOrderStatus>('repair_order_statuses')
        .where({ id: statusId, branch_id: branchId })
        .first();
      if (!status) {
        throw new BadRequestException({
          message: 'Status not found',
          location: 'status_id',
        });
      }
      return status;
    }

    const protectedStatus = await trx<RepairOrderStatus>('repair_order_statuses')
      .where({
        branch_id: branchId,
        status: 'Open',
        is_active: true,
        type: 'Open',
        is_protected: true,
      })
      .orderBy('sort', 'asc')
      .first();

    if (protectedStatus) {
      return protectedStatus;
    }

    const fallbackStatus = await trx<RepairOrderStatus>('repair_order_statuses')
      .where({
        branch_id: branchId,
        status: 'Open',
        is_active: true,
        type: 'Open',
      })
      .orderBy('sort', 'asc')
      .first();

    if (!fallbackStatus) {
      throw new BadRequestException({
        message: 'No active open repair order status found for this branch',
        location: 'branch_id',
      });
    }

    return fallbackStatus;
  }

  private async recordOpenApplicationHistory(
    trx: Knex.Transaction,
    order: RepairOrder,
    userId: string | null,
    userLabel: string,
  ): Promise<void> {
    await this.historyService.recordEntityCreated({
      db: trx,
      entityTable: this.table,
      entityPk: order.id,
      entityLabel: `#${order.number_id}`,
      rootEntityTable: this.table,
      rootEntityPk: order.id,
      branchId: order.branch_id,
      sourceType: 'user_api',
      sourceName: 'repair_orders.open_application',
      actionKey: 'repair_orders.create.open_application',
      actor: {
        actorRole: 'initiator',
        actorType: 'user',
        actorTable: 'users',
        actorPk: userId,
        actorLabel: userLabel,
      },
      values: {
        user_id: order.user_id,
        branch_id: order.branch_id,
        phone_category_id: order.phone_category_id,
        priority: order.priority,
        status_id: order.status_id,
        sort: order.sort,
        delivery_method: order.delivery_method,
        pickup_method: order.pickup_method,
        created_by: order.created_by,
        phone_number: order.phone_number,
        name: order.name,
        description: order.description,
        source: order.source,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
    });
  }

  private async resolveOpenApplicationBranchId(trx: Knex.Transaction): Promise<string> {
    const configuredBranchId =
      process.env.OPEN_REPAIR_ORDER_BRANCH_ID || DEFAULT_OPEN_APPLICATION_BRANCH_ID;

    if (configuredBranchId) {
      const configuredBranch = await trx('branches')
        .where({ id: configuredBranchId, status: 'Open', is_active: true })
        .first<{ id: string }>('id');

      if (configuredBranch) {
        return configuredBranch.id;
      }
    }

    const protectedBranch = await trx('branches')
      .where({ status: 'Open', is_active: true, is_protected: true })
      .orderBy('sort', 'asc')
      .first<{ id: string }>('id');

    if (protectedBranch) {
      return protectedBranch.id;
    }

    const fallbackBranch = await trx('branches')
      .where({ status: 'Open', is_active: true })
      .orderBy('sort', 'asc')
      .first<{ id: string }>('id');

    if (!fallbackBranch) {
      throw new BadRequestException({
        message: 'No active branch found for public applications',
        location: 'branch_id',
      });
    }

    return fallbackBranch.id;
  }

  private async resolveOpenApplicationPhoneCategory(
    trx: Knex.Transaction,
    phoneCategory: string,
  ): Promise<{ id?: string; customText?: string }> {
    const normalizedPhoneCategory = phoneCategory.trim();

    if (!normalizedPhoneCategory) {
      throw new BadRequestException({
        message: 'Phone category must not be empty',
        location: 'phone_category',
      });
    }

    if (!UUID_PATTERN.test(normalizedPhoneCategory)) {
      return { customText: normalizedPhoneCategory };
    }

    const hasChildrenQuery = this.knex.raw(
      `EXISTS (SELECT 1 FROM phone_categories c WHERE c.parent_id = pc.id AND c.status = 'Open') as has_children`,
    );
    const existingCategory = await trx('phone_categories as pc')
      .select('pc.id', hasChildrenQuery)
      .where({ 'pc.id': normalizedPhoneCategory, 'pc.is_active': true, 'pc.status': 'Open' })
      .first<{ id: string; has_children: boolean }>();

    if (!existingCategory) {
      throw new BadRequestException({
        message: 'Phone category not found or inactive',
        location: 'phone_category',
      });
    }

    if (existingCategory.has_children) {
      throw new BadRequestException({
        message: 'Phone category must not have children',
        location: 'phone_category',
      });
    }

    return { id: existingCategory.id };
  }

  private buildOpenApplicationDescription(
    description: string,
    customPhoneCategory?: string,
  ): string | null {
    const parts = [
      this.normalizeDescription(description),
      customPhoneCategory ? `Phone category: ${customPhoneCategory}` : null,
    ].filter((part): part is string => Boolean(part));

    if (!parts.length) {
      return null;
    }

    const normalizedDescription = parts.join('\n');

    if (normalizedDescription.length > 10000) {
      throw new BadRequestException({
        message: 'Description must not exceed 10000 characters',
        location: 'description',
      });
    }

    return normalizedDescription;
  }

  private normalizeOpenApplicationPhoneNumber(phoneNumber: string): string {
    const trimmed = phoneNumber.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (!digits) {
      throw new BadRequestException({
        message: 'Phone number must not be empty',
        location: 'phone_number',
      });
    }

    if (trimmed.startsWith('+') && !digits.startsWith('998')) {
      throw new BadRequestException({
        message: 'Phone number must be an Uzbekistan phone number',
        location: 'phone_number',
      });
    }

    let lastNineDigits: string | null = null;

    if (digits.length === 12 && digits.startsWith('998')) {
      lastNineDigits = digits.slice(3);
    } else if (digits.length === 9) {
      lastNineDigits = digits;
    } else if (digits.length === 10 && (digits.startsWith('0') || digits.startsWith('8'))) {
      lastNineDigits = digits.slice(1);
    } else if (digits.length > 9) {
      lastNineDigits = digits.slice(-9);
    }

    if (!lastNineDigits || lastNineDigits.length !== 9) {
      throw new BadRequestException({
        message: 'Phone number must match Uzbekistan phone number structure',
        location: 'phone_number',
      });
    }

    return `+998${lastNineDigits}`;
  }

  async update(
    admin: AdminPayload,
    orderId: string,
    dto: UpdateRepairOrderDto,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({ message: 'Order not found', location: 'repair_order' });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );
      const currentStatusPermission = permissions.find(
        (permission) =>
          permission.branch_id === order.branch_id && permission.status_id === order.status_id,
      );

      const logFields: { key: string; oldVal: unknown; newVal: unknown }[] = [];
      const updatedFields: Partial<RepairOrder> = {};
      const userUpdateFields: Record<string, unknown> = {};
      const hasSpecificNames = dto.first_name !== undefined || dto.last_name !== undefined;

      if (dto.name !== undefined || hasSpecificNames) {
        let finalFirstName: string | undefined;
        let finalLastName: string | undefined;
        let finalFullName: string | null = null;

        if (dto.name !== undefined) {
          const parsedName = this.parseCustomerNameOrThrow(dto.name);
          finalFirstName = parsedName.firstName;
          finalLastName = parsedName.lastName || undefined;
          finalFullName = parsedName.fullName;
        } else {
          let currentFirstName = '';
          let currentLastName = '';
          if (order.name) {
            const parts = order.name.trim().replace(/\s+/g, ' ').split(' ');
            currentFirstName = parts[0] || '';
            currentLastName = parts.slice(1).join(' ');
          }

          finalFirstName = dto.first_name !== undefined ? dto.first_name : currentFirstName;
          finalLastName = dto.last_name !== undefined ? dto.last_name : currentLastName;
          finalFullName = [finalFirstName, finalLastName].filter(Boolean).join(' ') || null;
        }

        if (finalFullName !== order.name) {
          updatedFields.name = finalFullName;
          userUpdateFields.first_name = finalFirstName;
          userUpdateFields.last_name = finalLastName;
          logFields.push({
            key: 'name',
            oldVal: order.name,
            newVal: finalFullName,
          });
        } else if (hasSpecificNames) {
          userUpdateFields.first_name = finalFirstName;
          userUpdateFields.last_name = finalLastName;
        }
      }

      const rawPhoneNumber = dto.phone_number ?? dto.phone;
      if (rawPhoneNumber !== undefined) {
        const normalizedPhone = this.normalizePhoneNumber(rawPhoneNumber);
        if (normalizedPhone !== order.phone_number) {
          updatedFields.phone_number = normalizedPhone;
          userUpdateFields.phone_number1 = normalizedPhone;
          logFields.push({
            key: 'phone_number',
            oldVal: order.phone_number,
            newVal: normalizedPhone,
          });
        }
      }

      if (dto.reject_cause_id !== undefined && dto.reject_cause_id !== order.reject_cause_id) {
        const cause = await trx('repair_order_reject_causes')
          .where({ id: dto.reject_cause_id, status: 'Open', is_active: true })
          .first();
        if (!cause) {
          throw new BadRequestException({
            message: 'Reject cause not found',
            location: 'reject_cause_id',
          });
        }

        await trx(this.table).where({ id: orderId }).update({
          reject_cause_id: dto.reject_cause_id,
          updated_at: new Date(),
        });

        logFields.push({
          key: 'reject_cause_id',
          oldVal: order.reject_cause_id,
          newVal: dto.reject_cause_id,
        });
        order.reject_cause_id = dto.reject_cause_id;
      }

      const fieldsToCheck: (keyof RepairOrder)[] = [
        'user_id',
        'status_id',
        'priority',
        'phone_category_id',
        'region_id',
        'imei',
        'agreed_date',
        'description',
        'source',
      ];
      for (const field of fieldsToCheck) {
        let dtoFieldValue = dto[field as keyof UpdateRepairOrderDto];
        if (field === 'description') {
          dtoFieldValue = this.normalizeDescription(dtoFieldValue as string | null | undefined);
        }
        if (dtoFieldValue !== undefined && dtoFieldValue !== order[field]) {
          if (field === 'agreed_date') {
            const shouldValidateAgreedDate =
              order.agreed_date === null ||
              currentStatusPermission?.cannot_continue_without_agreed_date === true;

            if (
              currentStatusPermission?.cannot_continue_without_agreed_date === true &&
              (dtoFieldValue === null || dtoFieldValue === undefined || dtoFieldValue === '')
            ) {
              throw new BadRequestException({
                message: 'Ushbu status uchun kelishilgan sana kiritilishi shart.',
                location: 'agreed_date',
              });
            }

            if (shouldValidateAgreedDate && dtoFieldValue !== null && dtoFieldValue !== undefined) {
              this.validateAgreedDateOrThrow(dtoFieldValue as string);
            }
          }

          if (field === 'status_id') {
            await this.validateStatusTransitionOrThrow(
              trx,
              admin,
              order,
              dtoFieldValue as string,
              permissions,
              orderId,
            );

            // Shift current queue items up to close the gap
            await trx(this.table)
              .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
              .andWhere('sort', '>', order.sort)
              .decrement('sort', 1);

            // Set new status and high sort, then move to top of the new status
            updatedFields.status_id = dtoFieldValue as string;
            updatedFields.sort = 999999;
            logFields.push({ key: 'status_id', oldVal: order.status_id, newVal: dtoFieldValue });
            logFields.push({ key: 'sort', oldVal: order.sort, newVal: 1 });

            // We'll call moveToTop after the update to ensure we have the correct record state
          } else {
            (updatedFields as Record<string, unknown>)[field] = dtoFieldValue;
            logFields.push({ key: field, oldVal: order[field], newVal: dtoFieldValue });
          }
        }
      }

      if (dto.user_id) {
        await this.permissionService.checkPermissionsOrThrow(
          admin.roles,
          order.branch_id,
          order.status_id,
          ['can_user_manage'],
          'repair_order_user_manage',
          permissions,
        );
        const user = await trx('users').where({ id: dto.user_id, status: 'Open' }).first();
        if (!user)
          throw new BadRequestException({ message: 'User not found', location: 'user_id' });
      }

      if (dto.phone_category_id) {
        const phoneCategory = await trx('phone_categories as pc')
          .select(
            'pc.*',
            this.knex.raw(
              `EXISTS (SELECT 1 FROM phone_categories c WHERE c.parent_id = pc.id AND c.status = 'Open') as has_children`,
            ),
          )
          .where({ 'pc.id': dto.phone_category_id, 'pc.is_active': true, 'pc.status': 'Open' })
          .first();
        if (!phoneCategory)
          throw new BadRequestException({
            message: 'Phone category not found or inactive',
            location: 'phone_category_id',
          });
        if (phoneCategory.has_children)
          throw new BadRequestException({
            message: 'Phone category must not have children',
            location: 'phone_category_id',
          });
      }

      if (dto.region_id) {
        await this.ensureRegionExists(trx, dto.region_id);
      }

      const linkedUserId =
        typeof updatedFields.user_id === 'string' ? updatedFields.user_id : order.user_id;

      if (linkedUserId && Object.keys(userUpdateFields).length > 0) {
        if (userUpdateFields.phone_number1) {
          const existingUser = await trx('users')
            .where({ phone_number1: userUpdateFields.phone_number1 })
            .whereNot({ id: linkedUserId })
            .andWhereNot({ status: 'Deleted' })
            .first();

          if (existingUser) {
            throw new BadRequestException({
              message: 'This phone number is already registered with another user',
              location: 'phone_number',
            });
          }
        }

        await trx('users')
          .where({ id: linkedUserId })
          .update({
            ...userUpdateFields,
            updated_at: new Date(),
          });
      } else if (
        !order.user_id &&
        !dto.user_id &&
        (updatedFields.status_id !== undefined ||
          dto.name !== undefined ||
          rawPhoneNumber !== undefined)
      ) {
        const nextName =
          (typeof updatedFields.name === 'string' ? updatedFields.name : order.name) ?? null;
        const nextPhone =
          (typeof updatedFields.phone_number === 'string'
            ? updatedFields.phone_number
            : order.phone_number) ?? null;

        if (nextName && nextPhone) {
          const linkedUserId = await this.ensureUserByPhone(trx, nextPhone, {
            allowCreate: true,
            source: 'employee',
            createdBy: admin.id,
            phoneVerified: false,
            logContext: 'Manual User',
            name: nextName,
          });

          if (linkedUserId && linkedUserId !== order.user_id) {
            updatedFields.user_id = linkedUserId;
            logFields.push({
              key: 'user_id',
              oldVal: order.user_id,
              newVal: linkedUserId,
            });
          }
        }
      }

      if (Object.keys(updatedFields).length) {
        await trx(this.table)
          .where({ id: orderId })
          .update({ ...updatedFields, updated_at: new Date() });

        // If status changed to a new one, ensure it's at the top of the new status list
        if (updatedFields.status_id) {
          const updatedOrder = await trx<RepairOrder>(this.table).where({ id: orderId }).first();
          if (updatedOrder) await this.moveToTop(trx, updatedOrder);
        }
      }

      await Promise.all([
        this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logFields, admin.id),
        this.initialProblemUpdater.update(trx, orderId, dto.initial_problems, admin),
        this.finalProblemUpdater.update(trx, orderId, dto.final_problems, admin),
      ]);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

      void this.notifyRepairOrderUpdate(order, {
        title: 'Buyurtma yangilandi',
        message: `Buyurtma #${order.number_id} ma'lumotlari yangilandi`,
        action: 'order_updated',
      });

      return { message: 'Repair order updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update repair order ${orderId}`);
      throw err;
    }
  }

  async findAllByAdminBranch(
    admin: AdminPayload,
    branchId: string,
    query: FindAllRepairOrdersQueryDto,
  ): Promise<
    Record<string, { metrics: { total_repair_orders: number }; repair_orders: FreshRepairOrder[] }>
  > {
    const {
      offset,
      limit,
      sort_by = 'sort',
      sort_order = 'asc',
      // Filters
      source_types,
      priorities,
      customer_name,
      phone_number,
      device_model,
      order_number,
      delivery_methods,
      pickup_methods,
      assigned_admin_ids,
      assigned_filter,
      date_from,
      date_to,
      status_ids,
    } = query;

    const permissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, branchId);

    let statusIds: string[] = permissions.filter((p) => p.can_view).map((p) => p.status_id);

    if (!statusIds.length) {
      return {};
    }

    // Narrow to requested status IDs (while keeping security boundary)
    if (status_ids?.length) {
      statusIds = statusIds.filter((id) => status_ids.includes(id));
      if (!statusIds.length) {
        return {};
      }
    }

    const agreedDateStatusIds = [
      ...new Set(
        permissions
          .filter((p) => p.cannot_continue_without_agreed_date && statusIds.includes(p.status_id))
          .map((p) => p.status_id),
      ),
    ];

    // Build filter hash for cache key
    const filterHash = JSON.stringify({
      source_types,
      priorities,
      customer_name,
      phone_number,
      device_model,
      order_number,
      delivery_methods,
      pickup_methods,
      assigned_admin_ids,
      assigned_filter,
      date_from,
      date_to,
      status_ids,
      agreedDateStatusIds,
    });

    const cacheKey = `${this.table}:${branchId}:${admin.id}:${sort_by}:${sort_order}:${offset}:${limit}:${Buffer.from(filterHash).toString('base64')}`;
    const cached: Record<
      string,
      { metrics: { total_repair_orders: number }; repair_orders: FreshRepairOrder[] }
    > | null = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build dynamic WHERE conditions
    const whereConditions: string[] = [];
    const endRow = offset + limit;
    const queryParams: Record<string, unknown> = { branchId, statusIds, limit, offset, endRow };

    // Filter by source types
    if (source_types?.length) {
      whereConditions.push(`ro.source = ANY(:sourceTypes)`);
      queryParams.sourceTypes = source_types;
    }

    // Filter by priorities
    if (priorities?.length) {
      whereConditions.push(`ro.priority = ANY(:priorities)`);
      queryParams.priorities = priorities;
    }

    // Filter by customer name
    if (customer_name) {
      whereConditions.push(
        `(
          LOWER(COALESCE(u.first_name || ' ' || u.last_name, ro.name, '')) ILIKE LOWER(:customerName)
          OR LOWER(COALESCE(u.first_name, ro.name, '')) ILIKE LOWER(:customerName)
          OR LOWER(COALESCE(u.last_name, ro.name, '')) ILIKE LOWER(:customerName)
          OR LOWER(COALESCE(ro.name, '')) ILIKE LOWER(:customerName)
        )`,
      );
      queryParams.customerName = `%${customer_name}%`;
    }

    // Filter by phone number
    if (phone_number) {
      const normalizedPhone = this.normalizePhoneNumber(phone_number);
      whereConditions.push(
        `(u.phone_number1 ILIKE :phoneNumber OR u.phone_number2 ILIKE :phoneNumber OR ro.phone_number LIKE :phoneNumber)`,
      );
      queryParams.phoneNumber = `%${normalizedPhone}%`;
    }

    // Filter by device model
    if (device_model) {
      whereConditions.push(
        `LOWER(pc.name_uz) ILIKE LOWER(:deviceModel) OR LOWER(pc.name_ru) ILIKE LOWER(:deviceModel) OR LOWER(pc.name_en) LIKE LOWER(:deviceModel)`,
      );
      queryParams.deviceModel = `%${device_model}%`;
    }

    // Filter by order number
    if (order_number) {
      whereConditions.push(`ro.number_id::text ILIKE :orderNumber`);
      queryParams.orderNumber = `%${order_number}%`;
    }

    // Filter by delivery methods
    if (delivery_methods?.length) {
      whereConditions.push(`ro.delivery_method = ANY(:deliveryMethods)`);
      queryParams.deliveryMethods = delivery_methods;
    }

    // Filter by pickup methods
    if (pickup_methods?.length) {
      whereConditions.push(`ro.pickup_method = ANY(:pickupMethods)`);
      queryParams.pickupMethods = pickup_methods;
    }

    // Filter by current admin assignments
    if (assigned_filter === 'Mine') {
      whereConditions.push(
        `EXISTS (SELECT 1 FROM repair_order_assign_admins aa WHERE aa.repair_order_id = ro.id AND aa.admin_id = :currentAdminId)`,
      );
      queryParams.currentAdminId = admin.id;
    }

    // Filter by assigned admin IDs
    if (assigned_admin_ids?.length) {
      whereConditions.push(
        `EXISTS (SELECT 1 FROM repair_order_assign_admins aa WHERE aa.repair_order_id = ro.id AND aa.admin_id = ANY(:assignedAdminIds))`,
      );
      queryParams.assignedAdminIds = assigned_admin_ids;
    }

    // Filter by date range
    if (date_from) {
      whereConditions.push(`ro.created_at >= :dateFrom`);
      queryParams.dateFrom = date_from;
    }

    if (date_to) {
      whereConditions.push(`ro.created_at <= :dateTo`);
      queryParams.dateTo = date_to;
    }

    if (agreedDateStatusIds.length) {
      queryParams.agreedDateStatusIds = agreedDateStatusIds;
    }

    const { orderClause, rowNumberOrder } = this.buildFindAllOrderClauses(
      sort_by,
      sort_order,
      agreedDateStatusIds,
    );

    let querySql = loadSQL('repair-orders/queries/find-all-by-admin-branch.sql')
      .replace('/*ORDER_CLAUSE*/', orderClause)
      .replace('/*ROW_NUMBER_ORDER*/', rowNumberOrder);

    // Filters are now applied inside the per_status_ranked CTE so that
    // row numbers reflect only the visible (filtered) orders per status column.
    const additionalWhere =
      whereConditions.length > 0 ? `\n  AND ${whereConditions.join('\n  AND ')}` : '';
    querySql = querySql.replace('/*ADDITIONAL_WHERE*/', additionalWhere);

    try {
      const countSql = `
        SELECT ro.status_id, COUNT(*) as total_count
        FROM repair_orders ro
          LEFT JOIN users u         ON ro.user_id          = u.id
          LEFT JOIN phone_categories pc ON ro.phone_category_id = pc.id
        WHERE ro.branch_id   = :branchId
          AND ro.status       = 'Open'
          AND ro.status_id    = ANY(:statusIds)
          ${additionalWhere}
        GROUP BY ro.status_id
      `;

      const [freshOrders, countResults] = await Promise.all([
        this.knex.raw(querySql, queryParams).then((r) => r.rows as FreshRepairOrder[]),
        this.knex
          .raw(countSql, queryParams)
          .then((r) => r.rows as { status_id: string; total_count: string }[]),
      ]);

      const countMap = countResults.reduce(
        (acc, row) => {
          acc[row.status_id] = parseInt(row.total_count, 10);
          return acc;
        },
        {} as Record<string, number>,
      );

      const result: Record<
        string,
        { metrics: { total_repair_orders: number }; repair_orders: FreshRepairOrder[] }
      > = {};
      for (const statusId of statusIds) {
        const ordersForStatus = freshOrders.filter(
          (o: FreshRepairOrder) => o.repair_order_status.id === statusId,
        );

        result[statusId] = {
          metrics: {
            total_repair_orders: countMap[statusId] || 0,
          },
          repair_orders: ordersForStatus,
        };
      }

      await this.redisService.set(cacheKey, result, 1800);

      return result;
    } catch (error) {
      this.logger.error(`Failed to get all repair orders:`, (error as Error)?.stack);
      if (error instanceof HttpException) throw error;
      throw error;
    }
  }

  async findAllUnfiltered(
    admin: AdminPayload,
    query: FindAllUnfilteredRepairOrdersDto,
  ): Promise<PaginationResult<RepairOrder>> {
    if (!this.isSuperAdmin(admin)) {
      throw new ForbiddenException({
        message: 'Only Super Admin can access all repair orders',
        location: 'role',
      });
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const baseQuery = this.knex<RepairOrder>(`${this.table} as ro`).leftJoin(
      'users as u',
      'ro.user_id',
      'u.id',
    );

    if (search) {
      const term = `%${search}%`;
      const normalizedPhoneTerm = `%${this.normalizePhoneNumber(search)}%`;
      void baseQuery.andWhere((builder) => {
        void builder
          .whereILike('ro.phone_number', term)
          .orWhereILike('ro.phone_number', normalizedPhoneTerm)
          .orWhereILike('ro.name', term)
          .orWhereILike('u.phone_number1', term)
          .orWhereILike('u.phone_number1', normalizedPhoneTerm)
          .orWhereILike('u.phone_number2', term)
          .orWhereILike('u.phone_number2', normalizedPhoneTerm)
          .orWhereRaw("CONCAT_WS(' ', u.first_name, u.last_name) ILIKE ?", [term]);
      });
    }

    const [rows, countRows] = await Promise.all([
      baseQuery.clone().select('ro.*').orderBy('ro.created_at', 'desc').offset(offset).limit(limit),
      baseQuery.clone().clearSelect().clearOrder().count<{ count: string }[]>('* as count'),
    ]);

    return {
      rows,
      total: Number(countRows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  private buildFindAllOrderClauses(
    sortBy: FindAllRepairOrdersQueryDto['sort_by'],
    sortOrder: FindAllRepairOrdersQueryDto['sort_order'],
    agreedDateStatusIds: string[],
  ): { orderClause: string; rowNumberOrder: string } {
    const direction = sortOrder.toUpperCase();
    const defaultOrder = `ro.${sortBy} ${direction}, ro.id ASC`;

    if (!agreedDateStatusIds.length) {
      return {
        orderClause: `ORDER BY ro.status_id, ${defaultOrder}`,
        rowNumberOrder: `ORDER BY ${defaultOrder}`,
      };
    }

    const hasAgreedDate = `ro.agreed_date IS NOT NULL AND BTRIM(ro.agreed_date::text) <> ''`;
    const isAgreedDateStatus = `ro.status_id = ANY(:agreedDateStatusIds)`;
    const agreedDateOrder = `
      CASE
        WHEN ${isAgreedDateStatus} AND ${hasAgreedDate} THEN 0
        WHEN ${isAgreedDateStatus} THEN 1
        ELSE 2
      END ASC,
      CASE
        WHEN ${isAgreedDateStatus} AND ${hasAgreedDate}
          THEN NULLIF(BTRIM(ro.agreed_date::text), '')::timestamp
      END ASC,
      CASE
        WHEN ${isAgreedDateStatus} AND NOT (${hasAgreedDate})
          THEN ro.created_at
      END ASC,
      ${defaultOrder}`;

    return {
      orderClause: `ORDER BY ro.status_id, ${agreedDateOrder}`,
      rowNumberOrder: `ORDER BY ${agreedDateOrder}`,
    };
  }

  async softDelete(admin: AdminPayload, orderId: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({
          message: 'Repair order not found or already deleted',
          location: 'repair_order',
        });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_delete'],
        'repair_order_delete',
        permissions,
      );

      await this.changeLogger.logIfChanged(
        trx,
        orderId,
        'status',
        order.status,
        'Deleted',
        admin.id,
      );
      await trx(this.table)
        .where({ id: orderId })
        .update({ status: 'Deleted', updated_at: new Date() });

      // Shift other orders up to maintain contiguity
      await trx(this.table)
        .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
        .andWhere('sort', '>', order.sort)
        .decrement('sort', 1);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      return { message: 'Repair order deleted successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to soft delete repair order ${orderId}`);
      throw err;
    }
  }

  async findById(admin: AdminPayload, orderId: string): Promise<RepairOrderDetails> {
    try {
      const query = loadSQL('repair-orders/queries/find-by-id.sql');
      const result: { rows: RepairOrderDetails[] } = await this.knex.raw(query, { orderId });
      const order: RepairOrderDetails = result.rows[0];

      if (!order)
        throw new NotFoundException({ message: 'Order not found', location: 'repair_order' });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch.id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch.id,
        order.repair_order_status.id,
        ['can_view'],
        'repair_order_view',
        permissions,
      );

      return order;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to get one repair order:`);
      throw err;
    }
  }

  async sendStatusChangeNotification(
    trx: Knex.Transaction,
    orderId: string,
    newStatusId: string,
    changedByAdminId: string,
  ): Promise<void> {
    const order = await trx('repair_orders').where({ id: orderId }).first();
    if (!order) return;

    const permissionedAdmins: RepairOrderStatusPermission[] = await trx(
      'repair_order_status_permissions',
    )
      .select('role_id')
      .where({ status_id: newStatusId, branch_id: order.branch_id, can_notification: true });

    if (!permissionedAdmins.length) return;

    const now = new Date();
    const notifications = permissionedAdmins.map((a) => ({
      role_id: a.role_id,
      title: 'Buyurtma holati o‘zgardi',
      message: `Buyurtma yangi statusga o'tdi`,
      type: 'info',
      meta: {
        order_id: order.id,
        from_status_id: order.status_id,
        to_status_id: newStatusId,
        changed_by: changedByAdminId,
        action: 'status_changed',
      },
      created_at: now,
      updated_at: now,
    }));

    await trx('notifications').insert(notifications);
  }

  async move(
    admin: AdminPayload,
    orderId: string,
    dto: MoveRepairOrderDto,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      // 1. Fetch the order first as other validations depend on its data
      const order = await this.getOrderOrThrow(trx, orderId);
      const isStatusChanged = dto.status_id !== order.status_id;
      const primaryRoleId = admin.roles[0]?.id;

      // 2. Run independent parallel validations/fetches
      const [permissions, transitionRule, targetStatus, activeRental] = await Promise.all([
        this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id),
        isStatusChanged
          ? this.getTransitionRule(
              trx,
              order.status_id,
              dto.status_id,
              order.branch_id,
              primaryRoleId,
            )
          : Promise.resolve<{ from_status_id: string; to_status_id: string } | null>(null),
        isStatusChanged
          ? this.getStatusDetails(trx, dto.status_id)
          : Promise.resolve<RepairOrderStatus | null>(null),
        isStatusChanged
          ? this.getActiveRental(trx, orderId)
          : Promise.resolve<{ id: string } | null>(null),
      ]);

      // 3. Permission and Rule Validations
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_change_status'],
        'repair_order_change_status',
        permissions,
      );

      if (isStatusChanged) {
        await this.validateStatusTransitionOrThrow(
          trx,
          admin,
          order,
          dto.status_id,
          permissions,
          orderId,
          transitionRule,
          targetStatus,
          activeRental,
        );
      }

      const updates: Partial<RepairOrder> = {};
      const logs: { key: string; oldVal: unknown; newVal: unknown }[] = [];

      // 4. Auto-link a user on status change when the order still has no user.
      if (!order.user_id && isStatusChanged) {
        const linkedUserId = await this.ensureUserLinked(trx, order, admin.id);
        if (linkedUserId) {
          updates.user_id = linkedUserId;
          logs.push({ key: 'user_id', oldVal: order.user_id, newVal: linkedUserId });
        }
      }

      // 5. Handle Re-sorting and Status Updates
      if (isStatusChanged) {
        await this.handleStatusChangeReordering(trx, order, dto);
        updates.status_id = dto.status_id;
        updates.sort = dto.sort || 1;
        logs.push({ key: 'status_id', oldVal: order.status_id, newVal: dto.status_id });
        logs.push({ key: 'sort', oldVal: order.sort, newVal: updates.sort });

        // Trigger notification asynchronously
        this.emitMoveNotification(order, dto.status_id);
      } else if (dto.sort !== undefined && dto.sort !== order.sort) {
        await this.handleSameStatusReordering(trx, order, dto.sort);
        updates.sort = dto.sort;
        logs.push({ key: 'sort', oldVal: order.sort, newVal: dto.sort });
      }

      // 6. Finalize updates
      if (Object.keys(updates).length) {
        await trx(this.table)
          .where({ id: orderId })
          .update({ ...updates, updated_at: new Date() });
      }

      await this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logs, admin.id);
      await trx.commit();

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      return { message: 'Repair order moved successfully' };
    } catch (err) {
      if (trx) await trx.rollback();
      this.logger.error(`Failed to move repair order ${orderId}: ${(err as Error).message}`);
      throw err;
    }
  }

  async updateSort(
    orderId: string,
    newSort: number,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({
          message: 'Repair order not found or already deleted',
          location: 'repair_order',
        });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );

      if (newSort === order.sort) return { message: 'No change needed' };

      if (newSort < order.sort) {
        await trx(this.table)
          .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', order.sort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx(this.table)
          .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', order.sort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx(this.table)
        .where({ id: orderId })
        .update({ sort: newSort, updated_at: new Date() });
      await this.changeLogger.logIfChanged(trx, orderId, 'sort', order.sort, newSort, admin.id);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      return { message: 'Repair order sort updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update sort for repair order ${orderId}`);
      throw err;
    }
  }

  async updateClientInfo(
    repairOrderId: string,
    updateDto: UpdateClientInfoDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: repairOrderId, status: 'Open' })
        .first();
      if (!order) {
        throw new NotFoundException('Repair order not found');
      }

      const permissions = await this.permissionService.findByRolesAndBranch(
        admin.roles,
        order.branch_id,
      );
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );

      const updateFields: Record<string, unknown> = {};
      const userUpdateFields: Record<string, unknown> = {};

      // Handle Name Update
      if (updateDto.name !== undefined) {
        updateFields.name = updateDto.name;
        // Attempt to split name for the users table
        const [firstName, ...lastNameParts] = updateDto.name.trim().split(/\s+/);
        userUpdateFields.first_name = firstName || '';
        userUpdateFields.last_name = lastNameParts.join(' ') || '';
      } else if (updateDto.first_name !== undefined || updateDto.last_name !== undefined) {
        const nameParts = [updateDto.first_name, updateDto.last_name].filter(Boolean);
        if (nameParts.length > 0) {
          updateFields.name = nameParts.join(' ');
        }
        if (updateDto.first_name !== undefined) userUpdateFields.first_name = updateDto.first_name;
        if (updateDto.last_name !== undefined) userUpdateFields.last_name = updateDto.last_name;
      }

      // Handle Phone Update
      const rawNewPhone = updateDto.phone_number ?? updateDto.phone;
      const newPhone =
        rawNewPhone !== undefined ? this.normalizePhoneNumber(rawNewPhone) : undefined;
      if (newPhone !== undefined) {
        updateFields.phone_number = newPhone;
        userUpdateFields.phone_number1 = newPhone;
      }

      if (Object.keys(updateFields).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      // 1. Update the linked User record if it exists
      if (order.user_id && Object.keys(userUpdateFields).length > 0) {
        // If phone is changing, check for duplicates
        if (userUpdateFields.phone_number1) {
          const existingUser = await trx('users')
            .where({ phone_number1: userUpdateFields.phone_number1 })
            .whereNot({ id: order.user_id })
            .first();

          if (existingUser) {
            throw new BadRequestException({
              message: 'This phone number is already registered with another user',
              location: 'phone_number',
            });
          }
        }

        userUpdateFields.updated_at = new Date();
        await trx('users').where({ id: order.user_id }).update(userUpdateFields);
      }

      // 2. Update the Repair Order
      updateFields.updated_at = new Date();
      await trx(this.table).where({ id: repairOrderId }).update(updateFields);

      // 3. Log changes and clean up
      await this.changeLogger.logAction(
        trx,
        repairOrderId,
        'client_info_updated',
        updateDto,
        admin.id,
      );
      await trx.commit();

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

      // Notify branch about the update
      void this.helper
        .getRepairOrderNotificationMeta(repairOrderId)
        .then((richMeta) => {
          this.notificationService
            .notifyBranch(this.knex, order.branch_id, {
              title: 'Buyurtma yangilandi',
              message: `Buyurtma #${order.number_id} mijoz ma'lumotlari yangilandi`,
              type: 'info',
              meta: {
                ...richMeta,
                action: 'order_updated',
              } as Record<string, unknown>,
            })
            .catch((err: Error) => {
              this.logger.error(
                `Failed to send branch notification for client info update on order ${repairOrderId}: ${err.message}`,
              );
            });
        })
        .catch((err: Error) => {
          this.logger.error(
            `Failed to fetch meta for branch notification for client info update on order ${repairOrderId}: ${err.message}`,
          );
        });

      return { message: 'Client info updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update client info for repair order ${repairOrderId}`);
      throw err;
    }
  }

  async updateProduct(
    repairOrderId: string,
    updateDto: UpdateProductDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex(this.table)
      .where({ id: repairOrderId, status: 'Open' })
      .first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_update'],
      'repair_order_update',
      permissions,
    );

    if (updateDto.phone_category_id) {
      const phoneCategory = await this.knex('phone_categories as pc')
        .select(
          'pc.*',
          this.knex.raw(
            `EXISTS (SELECT 1 FROM phone_categories c WHERE c.parent_id = pc.id AND c.status = 'Open') as has_children`,
          ),
        )
        .where({ 'pc.id': updateDto.phone_category_id, 'pc.is_active': true, 'pc.status': 'Open' })
        .first();

      if (!phoneCategory) {
        throw new BadRequestException({
          message: 'Phone category not found or inactive',
          location: 'phone_category_id',
        });
      }
      if (phoneCategory.has_children) {
        throw new BadRequestException({
          message: 'Phone category must not have children (must be a specific model)',
          location: 'phone_category_id',
        });
      }
    }

    const updateFields: Record<string, unknown> = {};
    const historyFields: { key: string; oldVal: unknown; newVal: unknown }[] = [];
    if (updateDto.phone_category_id !== undefined)
      updateFields.phone_category_id = updateDto.phone_category_id;
    if (updateDto.imei !== undefined) updateFields.imei = updateDto.imei;

    if (updateDto.phone_category_id !== undefined) {
      historyFields.push({
        key: 'phone_category_id',
        oldVal: order.phone_category_id,
        newVal: updateDto.phone_category_id,
      });
    }

    if (updateDto.imei !== undefined) {
      historyFields.push({
        key: 'imei',
        oldVal: order.imei,
        newVal: updateDto.imei,
      });
    }

    if (Object.keys(updateFields).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    updateFields.updated_at = new Date();

    const updated = await this.knex(this.table)
      .where({ id: repairOrderId })
      .update(updateFields)
      .returning('*');

    await this.changeLogger.logMultipleFieldsIfChanged(
      this.knex,
      repairOrderId,
      historyFields,
      admin.id,
    );
    await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

    // Notify branch about the update
    void this.helper
      .getRepairOrderNotificationMeta(repairOrderId)
      .then((richMeta) => {
        this.notificationService
          .notifyBranch(this.knex, order.branch_id, {
            title: 'Buyurtma yangilandi',
            message: `Buyurtma #${order.number_id} qurilma ma'lumotlari yangilandi`,
            type: 'info',
            meta: {
              ...richMeta,
              action: 'order_updated',
            } as Record<string, unknown>,
          })
          .catch((err: Error) => {
            this.logger.error(
              `Failed to send branch notification for product update on order ${repairOrderId}: ${err.message}`,
            );
          });
      })
      .catch((err: Error) => {
        this.logger.error(
          `Failed to fetch meta for branch notification for product update on order ${repairOrderId}: ${err.message}`,
        );
      });

    return updated[0] as unknown as { message: string };
  }

  async updateProblem(
    repairOrderId: string,
    problemId: string,
    updateDto: UpdateProblemDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex(this.table)
      .where({ id: repairOrderId, status: 'Open' })
      .first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const trx = await this.knex.transaction();
    try {
      let problemType: 'initial' | 'final' | null = null;
      let historyField: 'initial_problems' | 'final_problems' | null = null;

      // 1. Identify if it's an initial or final problem
      let existingProblem = await trx('repair_order_initial_problems')
        .where({ id: problemId, repair_order_id: repairOrderId })
        .first();

      if (existingProblem) {
        problemType = 'initial';
        historyField = 'initial_problems';
      } else {
        existingProblem = await trx('repair_order_final_problems')
          .where({ id: problemId, repair_order_id: repairOrderId })
          .first();
        if (existingProblem) {
          problemType = 'final';
          historyField = 'final_problems';
        }
      }

      if (!problemType) {
        await trx.rollback();
        throw new NotFoundException('Problem not found');
      }

      const permissions = await this.permissionService.findByRolesAndBranch(
        admin.roles,
        order.branch_id,
      );
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );

      // 2. Update problem details
      const problemTableName =
        problemType === 'initial' ? 'repair_order_initial_problems' : 'repair_order_final_problems';
      const oldProblems = await this.getProblemHistorySnapshot(trx, repairOrderId, problemType);

      const updateFields: Record<string, unknown> = {};
      if (updateDto.problem_category_id !== undefined)
        updateFields.problem_category_id = updateDto.problem_category_id;
      if (updateDto.price !== undefined) updateFields.price = updateDto.price;
      if (updateDto.estimated_minutes !== undefined)
        updateFields.estimated_minutes = updateDto.estimated_minutes;

      if (Object.keys(updateFields).length > 0) {
        updateFields.updated_at = new Date();
        await trx(problemTableName).where({ id: problemId }).update(updateFields);
      }

      // 3. Update parts
      if (updateDto.parts !== undefined) {
        const idColumn =
          problemType === 'initial'
            ? 'repair_order_initial_problem_id'
            : 'repair_order_final_problem_id';

        await trx('repair_order_parts')
          .where({ [idColumn]: problemId })
          .del();

        if (updateDto.parts.length > 0) {
          const partsData = updateDto.parts.map((p) => ({
            repair_order_id: repairOrderId,
            [idColumn]: problemId,
            repair_part_id: p.id,
            part_price: p.part_price,
            quantity: p.quantity,
            created_by: admin.id,
            created_at: new Date(),
            updated_at: new Date(),
          }));

          await trx('repair_order_parts').insert(partsData);
        }
      }

      const newProblems = await this.getProblemHistorySnapshot(trx, repairOrderId, problemType);
      if (historyField) {
        await this.changeLogger.logIfChanged(
          trx,
          repairOrderId,
          historyField,
          oldProblems,
          newProblems,
          admin.id,
        );
      }

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

      // Notify branch about the update
      void this.helper
        .getRepairOrderNotificationMeta(repairOrderId)
        .then((richMeta) => {
          this.notificationService
            .notifyBranch(this.knex, order.branch_id, {
              title: 'Buyurtma yangilandi',
              message: `Buyurtma #${order.number_id} muammo/narx ma'lumotlari yangilandi`,
              type: 'info',
              meta: {
                ...richMeta,
                action: 'order_updated',
              } as Record<string, unknown>,
            })
            .catch((err: Error) => {
              this.logger.error(
                `Failed to send branch notification for problem update on order ${repairOrderId}: ${err.message}`,
              );
            });
        })
        .catch((err: Error) => {
          this.logger.error(
            `Failed to fetch meta for branch notification for problem update on order ${repairOrderId}: ${err.message}`,
          );
        });

      return { message: 'Problem updated successfully' };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async transferBranch(
    repairOrderId: string,
    transferDto: TransferBranchDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex(this.table)
      .where({ id: repairOrderId, status: 'Open' })
      .first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const currentPermissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_update'],
      'repair_order_update',
      currentPermissions,
    );

    const newBranch = await this.knex('branches')
      .where({ id: transferDto.new_branch_id, status: 'Open' })
      .first();

    if (!newBranch) {
      throw new BadRequestException('Invalid or inactive branch');
    }

    const hasPermission = await this.knex('admin_branches')
      .where({
        admin_id: admin.id,
        branch_id: transferDto.new_branch_id,
      })
      .first();

    if (!hasPermission) {
      throw new ForbiddenException('No permission to transfer to this branch');
    }

    const trx = await this.knex.transaction();
    try {
      // Shift orders in the current branch up to maintain contiguity
      await trx(this.table)
        .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
        .andWhere('sort', '>', order.sort)
        .decrement('sort', 1);

      const updated = await trx(this.table)
        .where({ id: repairOrderId })
        .update({
          branch_id: transferDto.new_branch_id,
          sort: 999999, // Temp end of list
          updated_at: new Date(),
        })
        .returning('*');

      await this.moveToTop(trx, updated[0] as RepairOrder);

      await this.changeLogger.logIfChanged(
        trx,
        repairOrderId,
        'branch_id',
        order.branch_id,
        transferDto.new_branch_id,
        admin.id,
      );

      await trx.commit();

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      await this.redisService.flushByPrefix(`${this.table}:${transferDto.new_branch_id}`);

      // Notify BOTH branches about the transfer
      // Current (old) branch
      void this.helper
        .getRepairOrderNotificationMeta(repairOrderId)
        .then((richMeta) => {
          // Notify old branch: order removed (moved out)
          this.notificationService
            .notifyBranch(this.knex, order.branch_id, {
              title: "Buyurtma ko'chirildi",
              message: `Buyurtma #${order.number_id} boshqa filialga ko'chirildi`,
              type: 'info',
              meta: {
                ...richMeta,
                action: 'order_updated',
              } as Record<string, unknown>,
            })
            .catch((err: Error) => {
              this.logger.error(
                `Failed to send branch notification for transfer out on order ${repairOrderId}: ${err.message}`,
              );
            });

          // Notify new branch: order arrived
          this.notificationService
            .notifyBranch(this.knex, transferDto.new_branch_id, {
              title: "Yangi buyurtma (Ko'chirildi)",
              message: `Boshqa filialdan yangi buyurtma ko'chirib kelindi: #${order.number_id}`,
              type: 'info',
              meta: {
                ...richMeta,
                action: 'order_updated',
              } as Record<string, unknown>,
            })
            .catch((err: Error) => {
              this.logger.error(
                `Failed to send branch notification for transfer in on order ${repairOrderId}: ${err.message}`,
              );
            });
        })
        .catch((err: Error) => {
          this.logger.error(
            `Failed to fetch meta for branch notification for transfer on order ${repairOrderId}: ${err.message}`,
          );
        });

      return updated[0] as unknown as { message: string };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async findOpenOrderByPhoneNumber(
    branchId: string,
    phoneNumber: string,
    userId?: string | null,
  ): Promise<RepairOrder | undefined> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const phoneCandidates = this.getPhoneLookupCandidates(normalizedPhone);
    let query = this.buildTelephonyWorkflowOpenOrderQuery(this.knex).where({
      'ro.branch_id': branchId,
    });

    if (userId) {
      query = query.andWhere((qb): void => {
        void qb.where({ 'ro.user_id': userId }).orWhere((phoneQb) => {
          void phoneQb.whereIn('ro.phone_number', phoneCandidates);
        });
      });
    } else {
      query = query.whereIn('ro.phone_number', phoneCandidates);
    }

    return query.first();
  }

  async incrementCallCount(orderId: string): Promise<void> {
    const trx = await this.knex.transaction();
    try {
      const order = await trx<RepairOrder>(this.table).where({ id: orderId }).first();
      if (!order || order.status !== 'Open') {
        await trx.rollback();
        return;
      }

      await trx(this.table)
        .where({ id: orderId })
        .update({
          call_count: this.knex.raw('call_count + 1'),
          updated_at: new Date().toISOString(),
        });

      await this.moveToTop(trx, order);
      await trx.commit();

      void this.notifyRepairOrderUpdate(order, {
        title: 'Buyurtma yangilandi',
        message: `Mavjud buyurtma yangilandi (Qo'ng'iroq): #${order.number_id}`,
        action: 'order_updated',
      });

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async incrementMissedCallCount(orderId: string): Promise<void> {
    const trx = await this.knex.transaction();
    try {
      const order = await trx<RepairOrder>(this.table).where({ id: orderId }).first();
      if (!order || order.status !== 'Open') {
        await trx.rollback();
        return;
      }

      await trx(this.table)
        .where({ id: orderId })
        .update({
          missed_calls: this.knex.raw('missed_calls + 1'),
          updated_at: new Date().toISOString(),
        });

      await this.moveToTop(trx, order);
      await this.assignFallbackAdminIfOrderHasNone(trx, order.id, order.branch_id);
      await trx.commit();

      void this.notifyRepairOrderUpdate(order, {
        title: 'Buyurtma yangilandi',
        message: `Mavjud buyurtma yangilandi (O'tib ketilgan qo'ng'iroq): #${order.number_id}`,
        action: 'order_updated',
      });

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async recordCustomerNoAnswer(orderId: string, occurredAt: Date = new Date()): Promise<void> {
    const trx = await this.knex.transaction();
    try {
      const order = await trx<RepairOrder>(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order) {
        await trx.rollback();
        return;
      }

      const currentStatus = await this.getStatusDetails(trx, order.status_id);
      if (!this.isNoAnswerTrackableStatus(currentStatus)) {
        await trx.rollback();
        return;
      }

      const nextCount = Number(order.customer_no_answer_count ?? 0) + 1;

      if (nextCount > this.customerNoAnswerLimit) {
        const invalidStatus = await this.getRequiredStatusByType(trx, order.branch_id, 'Invalid');
        const rejectCauseId = await this.getNoAnswerRejectCauseId(trx);
        const previousDueAt = order.customer_no_answer_due_at ?? null;

        await this.moveOrderToStatusAtTop(trx, order, invalidStatus.id);
        await trx(this.table).where({ id: order.id }).update({
          status_id: invalidStatus.id,
          sort: 1,
          reject_cause_id: rejectCauseId,
          customer_no_answer_count: nextCount,
          last_customer_no_answer_at: occurredAt,
          customer_no_answer_due_at: null,
          updated_at: new Date().toISOString(),
        });

        await this.logSystemChanges(trx, order.id, [
          { key: 'status_id', oldVal: order.status_id, newVal: invalidStatus.id },
          { key: 'sort', oldVal: order.sort, newVal: 1 },
          { key: 'reject_cause_id', oldVal: order.reject_cause_id, newVal: rejectCauseId },
          {
            key: 'customer_no_answer_count',
            oldVal: order.customer_no_answer_count ?? 0,
            newVal: nextCount,
          },
          {
            key: 'customer_no_answer_due_at',
            oldVal: previousDueAt,
            newVal: null,
          },
        ]);

        await trx.commit();

        void this.notifyRepairOrderUpdate(order, {
          title: 'Buyurtma sifatsizga o‘tkazildi',
          message: `Buyurtma #${order.number_id} mijoz javob bermagani uchun Sifatsiz statusiga o'tkazildi`,
          action: 'customer_no_answer_invalidated',
          fromStatusId: order.status_id,
          toStatusId: invalidStatus.id,
        });

        await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
        return;
      }

      const dueAt = new Date(
        occurredAt.getTime() + this.customerNoAnswerDelayHours * 60 * 60 * 1000,
      );

      await trx(this.table).where({ id: order.id }).update({
        customer_no_answer_count: nextCount,
        last_customer_no_answer_at: occurredAt,
        customer_no_answer_due_at: dueAt,
        updated_at: new Date().toISOString(),
      });

      await trx.commit();

      void this.notifyRepairOrderUpdate(order, {
        title: "Mijoz qo'ng'iroqqa javob bermadi",
        message: `Buyurtma #${order.number_id} bo'yicha javobsiz qo'ng'iroq qayd etildi (${nextCount})`,
        action: 'customer_no_answer_recorded',
      });

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async processDueCustomerNoAnswer(orderId: string): Promise<void> {
    const trx = await this.knex.transaction();
    try {
      const order = await trx<RepairOrder>(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (
        !order ||
        !order.customer_no_answer_due_at ||
        Number(order.customer_no_answer_count ?? 0) <= 0
      ) {
        await trx.rollback();
        return;
      }

      const dueAt = new Date(order.customer_no_answer_due_at);
      if (Number.isNaN(dueAt.getTime()) || dueAt > new Date()) {
        await trx.rollback();
        return;
      }

      const currentStatus = await this.getStatusDetails(trx, order.status_id);
      if (!this.isNoAnswerTrackableStatus(currentStatus)) {
        await trx(this.table)
          .where({ id: order.id })
          .update({ customer_no_answer_due_at: null, updated_at: new Date().toISOString() });
        await trx.commit();
        await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
        return;
      }

      const currentCount = Number(order.customer_no_answer_count ?? 0);
      if (currentCount > this.customerNoAnswerLimit) {
        const invalidStatus = await this.getRequiredStatusByType(trx, order.branch_id, 'Invalid');
        const rejectCauseId = await this.getNoAnswerRejectCauseId(trx);

        await this.moveOrderToStatusAtTop(trx, order, invalidStatus.id);
        await trx(this.table).where({ id: order.id }).update({
          status_id: invalidStatus.id,
          sort: 1,
          reject_cause_id: rejectCauseId,
          customer_no_answer_due_at: null,
          updated_at: new Date().toISOString(),
        });

        await this.logSystemChanges(trx, order.id, [
          { key: 'status_id', oldVal: order.status_id, newVal: invalidStatus.id },
          { key: 'sort', oldVal: order.sort, newVal: 1 },
          { key: 'reject_cause_id', oldVal: order.reject_cause_id, newVal: rejectCauseId },
          {
            key: 'customer_no_answer_due_at',
            oldVal: order.customer_no_answer_due_at,
            newVal: null,
          },
        ]);

        await trx.commit();

        void this.notifyRepairOrderUpdate(order, {
          title: 'Buyurtma sifatsizga o‘tkazildi',
          message: `Buyurtma #${order.number_id} mijoz javob bermagani uchun Sifatsiz statusiga o'tkazildi`,
          action: 'customer_no_answer_invalidated',
          fromStatusId: order.status_id,
          toStatusId: invalidStatus.id,
        });

        await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
        return;
      }

      const missedStatus = await this.getRequiredStatusByType(trx, order.branch_id, 'Missed');

      await this.moveOrderToStatusAtTop(trx, order, missedStatus.id);
      await trx(this.table).where({ id: order.id }).update({
        status_id: missedStatus.id,
        sort: 1,
        customer_no_answer_due_at: null,
        updated_at: new Date().toISOString(),
      });

      await this.logSystemChanges(trx, order.id, [
        { key: 'status_id', oldVal: order.status_id, newVal: missedStatus.id },
        { key: 'sort', oldVal: order.sort, newVal: 1 },
        {
          key: 'customer_no_answer_due_at',
          oldVal: order.customer_no_answer_due_at,
          newVal: null,
        },
      ]);

      await trx.commit();

      void this.notifyRepairOrderUpdate(order, {
        title: "Buyurtma Ko'tarmadi statusiga o'tkazildi",
        message: `Buyurtma #${order.number_id} 24 soat javobsiz qolgani uchun Ko'tarmadi statusiga o'tkazildi`,
        action: 'customer_no_answer_missed',
        fromStatusId: order.status_id,
        toStatusId: missedStatus.id,
      });

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async createFromWebhook(data: {
    userId: string | null;
    branchId: string;
    statusId: string;
    phoneNumber: string;
    source: 'Kiruvchi qongiroq' | 'Chiquvchi qongiroq';
    onlinepbxCode?: string | null;
    fallbackToFewestOpen?: boolean;
    assignmentSource?: RepairOrderAssignmentSource;
  }): Promise<RepairOrder> {
    const trx = await this.knex.transaction();
    try {
      const normalizedPhoneNumber = this.normalizePhoneNumber(data.phoneNumber);
      const phoneCandidates = this.getPhoneLookupCandidates(normalizedPhoneNumber);
      let resolvedUserId = data.userId;

      if (!resolvedUserId) {
        resolvedUserId = await this.ensureWebhookUser(trx, normalizedPhoneNumber);
      }

      const existingOrder = (await this.buildTelephonyWorkflowOpenOrderQuery(trx)
        .where({ 'ro.branch_id': data.branchId })
        .whereIn('ro.phone_number', phoneCandidates)
        .first()) as RepairOrder | undefined;

      if (existingOrder) {
        const existingOrderUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          call_count: this.knex.raw('call_count + 1'),
        };
        if (resolvedUserId && !existingOrder.user_id) {
          existingOrderUpdates.user_id = resolvedUserId;
        }

        await trx(this.table).where({ id: existingOrder.id }).update(existingOrderUpdates);

        await this.moveToTop(trx, existingOrder);
        if (data.fallbackToFewestOpen === true) {
          await this.assignFallbackAdminIfOrderHasNone(trx, existingOrder.id, data.branchId);
        }
        await trx.commit();

        void this.notifyRepairOrderUpdate(existingOrder, {
          title: 'Buyurtma yangilandi',
          message: `Mavjud buyurtma yangilandi (Telefoniya): #${existingOrder.number_id}`,
          action: 'order_updated',
        });

        await this.redisService.flushByPrefix(`${this.table}:${data.branchId}`);
        return existingOrder;
      }

      const [newOrder] = await trx<RepairOrder>(this.table)
        .insert({
          user_id: resolvedUserId,
          branch_id: data.branchId,
          priority: 'Medium',
          status_id: data.statusId,
          sort: 999999, // Temporary high sort for new order
          delivery_method: 'Self',
          pickup_method: 'Self',
          created_by: null,
          phone_number: normalizedPhoneNumber,
          name: null,
          description: null,
          source: data.source,
          call_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returning('*');

      this.logger.log(
        `[Webhook Order] Created new repair order ${newOrder.id} (${newOrder.number_id}) for user ${resolvedUserId}`,
      );

      // Move the new order to the top using the reusable helper
      await this.moveToTop(trx, newOrder);

      let assignedAdminId: string | null = null;

      // 1. Try to assign based on onlinepbxCode
      if (data.onlinepbxCode) {
        assignedAdminId = await this.resolveWebhookAdminId(trx, data.branchId, data.onlinepbxCode);
      }

      // 2. If no admin found or no code provided, find the least busy active admin (only if allowed)
      if (!assignedAdminId && data.fallbackToFewestOpen === true) {
        assignedAdminId = await this.resolveLeastBusyWebhookAdminId(trx, data.branchId);
      }

      // 3. Assign the admin to the repair order if an admin was found
      if (assignedAdminId) {
        const assignmentSource =
          data.assignmentSource ??
          (data.fallbackToFewestOpen === true
            ? ASSIGNMENT_SOURCE_TELEPHONY_AUTO
            : ASSIGNMENT_SOURCE_TELEPHONY_ANSWERED);
        this.logger.log(
          `[Webhook Order] Assigning repair order ${newOrder.id} to admin ${assignedAdminId}`,
        );
        await this.assignTelephonyAdminToOrderIfEligible(trx, newOrder.id, assignedAdminId, {
          assignmentSource,
        });
      } else {
        this.logger.log(`[Webhook Order] No admin assigned to repair order ${newOrder.id}`);
      }

      await trx.commit();

      void this.notifyRepairOrderUpdate(newOrder, {
        title: 'Yangi buyurtma',
        message: `Filialda yangi buyurtma yaratildi (Telefoniya): #${newOrder.number_id}`,
        action: 'order_created',
        targetAdminId: assignedAdminId,
      });

      this.webhookService.sendWebhook(newOrder.id).catch((err: unknown) => {
        this.logger.error(
          `[RepairOrdersService] Webhook error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

      await this.redisService.flushByPrefix(`${this.table}:${data.branchId}`);
      return newOrder;
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  private async findUserByPhone(
    trx: Knex.Transaction,
    phoneNumber: string,
  ): Promise<User | undefined> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const phoneCandidates = this.getPhoneLookupCandidates(normalizedPhone);

    return trx<User>('users')
      .whereIn('phone_number1', phoneCandidates)
      .andWhereNot({ status: 'Deleted' })
      .first();
  }

  private async enrichExistingUserNameIfMissing(
    trx: Knex.Transaction,
    user: Pick<User, 'id' | 'first_name' | 'last_name'>,
    name: string,
    logContext: 'Webhook User' | 'Manual User' | 'Open Application User',
  ): Promise<void> {
    const parsedName = this.parseCustomerNameOrThrow(name);
    const nextUserFields: Partial<User> = {};

    if (!user.first_name?.trim()) {
      nextUserFields.first_name = parsedName.firstName;
    }

    if (!user.last_name?.trim() && parsedName.lastName) {
      nextUserFields.last_name = parsedName.lastName;
    }

    if (!Object.keys(nextUserFields).length) {
      return;
    }

    await trx('users')
      .where({ id: user.id })
      .update({
        ...nextUserFields,
        updated_at: new Date().toISOString(),
      });

    this.logger.log(`[${logContext}] Enriched existing user ${user.id} with missing name fields.`);
  }

  private async ensureUserByPhone(
    trx: Knex.Transaction,
    phoneNumber: string,
    options: {
      allowCreate: boolean;
      source: 'employee' | 'Telefoniya' | 'web';
      createdBy: string | null;
      phoneVerified?: boolean;
      logContext: 'Webhook User' | 'Manual User' | 'Open Application User';
      name?: string | null;
    },
  ): Promise<string | null> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const existingUser = await this.findUserByPhone(trx, phoneNumber);

    if (existingUser) {
      await this.normalizeExistingUserPhoneIfNeeded(trx, existingUser, normalizedPhone);

      if (options.name) {
        await this.enrichExistingUserNameIfMissing(
          trx,
          existingUser,
          options.name,
          options.logContext,
        );
      }

      this.logger.log(
        `[${options.logContext}] Found existing user ${existingUser.id} for phone ${normalizedPhone}`,
      );
      return existingUser.id;
    }

    if (!options.allowCreate) {
      this.logger.log(
        `[${options.logContext}] No existing user found for phone ${phoneNumber}. Creation is not allowed here.`,
      );
      return null;
    }

    this.logger.log(
      `[${options.logContext}] No existing user found for phone ${normalizedPhone}. Creating new user...`,
    );

    const parsedName = options.name ? this.parseCustomerNameOrThrow(options.name) : null;
    const [newUser]: { id: string }[] = await trx('users')
      .insert({
        first_name: parsedName?.firstName ?? null,
        last_name: parsedName?.lastName ?? null,
        phone_number1: normalizedPhone,
        is_active: true,
        phone_verified: options.phoneVerified ?? false,
        source: options.source,
        created_by: options.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'Open',
      })
      .returning('id');

    return newUser.id;
  }

  private async ensureWebhookUser(trx: Knex.Transaction, phoneNumber: string): Promise<string> {
    const userId = await this.ensureUserByPhone(trx, phoneNumber, {
      allowCreate: true,
      source: 'Telefoniya',
      createdBy: null,
      phoneVerified: true,
      logContext: 'Webhook User',
    });

    if (!userId) {
      throw new BadRequestException({
        message: 'Unable to resolve webhook user',
        location: 'phone_number',
      });
    }

    return userId;
  }

  private async ensureRegionExists(
    trx: Knex.Transaction | Knex,
    regionId: string,
  ): Promise<RepairOrderRegion> {
    const region = await trx<RepairOrderRegion>('repair_order_regions')
      .where({ id: regionId })
      .first();

    if (!region) {
      throw new BadRequestException({
        message: 'Repair order region not found',
        location: 'region_id',
      });
    }

    return region;
  }

  private async findExistingCustomerRepairOrders(
    trx: Knex.Transaction,
    userId: string | undefined,
    phoneNumber: string,
  ): Promise<RepairOrder[]> {
    if (!userId && !phoneNumber) {
      return [];
    }

    const phoneCandidates = phoneNumber ? this.getPhoneLookupCandidates(phoneNumber) : [];
    let query = trx<RepairOrder>(this.table).andWhereNot({ status: 'Deleted' });

    if (userId && phoneCandidates.length) {
      query = query.andWhere((qb) => {
        void qb.where({ user_id: userId }).orWhere((phoneQb) => {
          void phoneQb.whereIn('phone_number', phoneCandidates);
        });
      });
    } else if (userId) {
      query = query.where({ user_id: userId });
    } else if (phoneCandidates.length) {
      query = query.whereIn('phone_number', phoneCandidates);
    }

    return query.select('*') as unknown as Promise<RepairOrder[]>;
  }

  private ensureImeiForMatchingPhoneCategory(
    existingOrders: RepairOrder[],
    phoneCategoryId: string,
    imei?: string,
  ): void {
    const hasSameCategoryOrder = existingOrders.some(
      (order) => order.phone_category_id === phoneCategoryId,
    );

    if (!hasSameCategoryOrder || imei) {
      return;
    }

    throw new BadRequestException({
      message: 'Mijozda ayni telefon turi bo‘yicha vazifa mavjud bo‘lsa, IMEI kiritilishi shart',
      location: 'imei',
    });
  }

  private validateAgreedDateOrThrow(value: string): void {
    const inputDate = parseAgreedDateInput(value);

    if (!inputDate) {
      throw new BadRequestException({
        message: 'Agreed date must be in YYYY-MM-DD HH:mm format',
        location: 'agreed_date',
      });
    }

    if (inputDate <= new Date()) {
      throw new BadRequestException({
        message: 'Agreed date must be in the future',
        location: 'agreed_date',
      });
    }
  }

  /**
   * Finds an existing user by the repair order's phone_number column,
   * or creates a new one using phone_number + name from the order.
   *
   * @returns The user ID to assign, or null if phone_number is missing.
   */
  private async ensureUserLinked(
    trx: Knex.Transaction,
    order: RepairOrder,
    adminId: string,
  ): Promise<string | null> {
    const phone = order.phone_number;
    if (!phone) return null;

    return this.ensureUserByPhone(trx, phone, {
      allowCreate: true,
      source: 'employee',
      createdBy: adminId,
      phoneVerified: false,
      logContext: 'Manual User',
      name: order.name,
    });
  }

  private parseCustomerNameOrThrow(name: string): {
    fullName: string;
    firstName: string;
    lastName: string | null;
  } {
    const fullName = name.trim().replace(/\s+/g, ' ');

    if (!fullName) {
      throw new BadRequestException({
        message: 'Name must not be empty',
        location: 'name',
      });
    }

    const [firstName, ...lastNameParts] = fullName.split(' ');
    return {
      fullName,
      firstName,
      lastName: lastNameParts.join(' ') || null,
    };
  }

  /**
   * Reusable helper to move a repair order to the top of its status list.
   * Shifts existing items that were above this one.
   */
  async moveToTopById(orderId: string): Promise<void> {
    const trx = await this.knex.transaction();
    try {
      const order = await trx<RepairOrder>(this.table).where({ id: orderId }).first();
      if (!order || order.status !== 'Open') {
        await trx.rollback();
        return;
      }

      await this.moveToTop(trx, order);
      await trx(this.table).where({ id: order.id }).update({
        customer_no_answer_count: 0,
        last_customer_no_answer_at: null,
        customer_no_answer_due_at: null,
        updated_at: new Date().toISOString(),
      });
      await trx.commit();

      void this.notifyRepairOrderUpdate(order, {
        title: 'Buyurtma yangilandi',
        message: `Mavjud buyurtma yangilandi (Tugallangan qo'ng'iroq): #${order.number_id}`,
        action: 'order_updated',
      });

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Reusable helper to move a repair order to the top of its status list.
   * Shifts existing items that were above this one.
   */
  private async moveToTop(trx: Knex.Transaction, order: RepairOrder): Promise<void> {
    if (order.sort === 1) return;

    // Shift all orders currently above this one down by 1
    await trx(this.table)
      .where({
        branch_id: order.branch_id,
        status_id: order.status_id,
        status: 'Open',
      })
      .andWhere('sort', '<', order.sort)
      .increment('sort', 1);

    // Set this order's sort to 1
    await trx(this.table).where({ id: order.id }).update({ sort: 1 });
  }

  private async notifyRepairOrderUpdate(
    order: RepairOrder,
    payload: {
      title: string;
      message: string;
      action: string;
      openMenu?: boolean;
      targetAdminId?: string | null;
      fromStatusId?: string;
      toStatusId?: string;
    },
  ): Promise<void> {
    try {
      const richMeta = await this.helper.getRepairOrderNotificationMeta(order.id, this.knex);
      if (!richMeta) {
        throw new Error(`Failed to fetch notification meta for order ${order.id}`);
      }

      const meta: RepairNotificationMeta = {
        ...richMeta,
        action: payload.action,
        open_menu: payload.openMenu,
        from_status_id: payload.fromStatusId,
        to_status_id: payload.toStatusId,
      };

      if (payload.targetAdminId) {
        const admins = await this.knex('admin_branches')
          .where({ branch_id: order.branch_id })
          .select<{ admin_id: string }[]>('admin_id');
        const adminIds = admins.map((a) => a.admin_id);

        const targetId = payload.targetAdminId;
        const otherIds = adminIds.filter((id) => id !== targetId);

        await this.notificationService.notifyAdmins(this.knex, [targetId], {
          title: payload.title,
          message: payload.message,
          type: 'info',
          meta: meta as unknown as Record<string, unknown>,
        });

        if (otherIds.length > 0) {
          const standardMeta = { ...meta, open_menu: false };
          await this.notificationService.notifyAdmins(this.knex, otherIds, {
            title: payload.title,
            message: payload.message,
            type: 'info',
            meta: standardMeta as unknown as Record<string, unknown>,
          });
        }
      } else {
        await this.notificationService.notifyBranch(this.knex, order.branch_id, {
          title: payload.title,
          message: payload.message,
          type: 'info',
          meta: meta as unknown as Record<string, unknown>,
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to send notification for order ${order.id}: ${(err as Error).message}`,
      );
    }
  }

  async handleCallAnswered(data: {
    branchId: string;
    phoneNumber: string;
    onlinepbxCode: string;
    userId: string | null;
    openMenu?: boolean;
    source: 'Kiruvchi qongiroq' | 'Chiquvchi qongiroq';
  }): Promise<void> {
    const trx = await this.knex.transaction();
    try {
      const normalizedPhoneNumber = this.normalizePhoneNumber(data.phoneNumber);
      const phoneCandidates = this.getPhoneLookupCandidates(normalizedPhoneNumber);
      let order = (await this.buildTelephonyWorkflowOpenOrderQuery(trx)
        .where({ 'ro.branch_id': data.branchId })
        .whereIn('ro.phone_number', phoneCandidates)
        .first()) as RepairOrder | undefined;

      const targetAdminId = await this.resolveWebhookAdminId(
        trx,
        data.branchId,
        data.onlinepbxCode,
      );

      const isUpdate = !!order;

      if (!order) {
        const defaultStatus = '50000000-0000-0000-0001-001000000000';
        const [newOrder] = (await trx<RepairOrder>(this.table)
          .insert({
            user_id: data.userId,
            branch_id: data.branchId,
            status_id: defaultStatus,
            priority: 'Medium',
            sort: 999999,
            delivery_method: 'Self',
            pickup_method: 'Self',
            phone_number: normalizedPhoneNumber,
            description: null,
            source: data.source,
            call_count: 1,
            customer_no_answer_count: 0,
            last_customer_no_answer_at: null,
            customer_no_answer_due_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .returning('*')) as RepairOrder[];
        order = newOrder;

        if (targetAdminId) {
          await this.assignTelephonyAdminToOrderIfEligible(trx, order.id, targetAdminId, {
            replaceAutoAssignedSameRole: true,
            assignmentSource: ASSIGNMENT_SOURCE_TELEPHONY_ANSWERED,
          });
        }
      } else {
        await trx(this.table)
          .where({ id: order.id })
          .update({
            updated_at: new Date().toISOString(),
            call_count: this.knex.raw('call_count + 1'),
            customer_no_answer_count: 0,
            last_customer_no_answer_at: null,
            customer_no_answer_due_at: null,
          });

        if (targetAdminId) {
          await this.assignTelephonyAdminToOrderIfEligible(trx, order.id, targetAdminId, {
            replaceAutoAssignedSameRole: true,
            assignmentSource: ASSIGNMENT_SOURCE_TELEPHONY_ANSWERED,
          });
        }
      }

      await this.moveToTop(trx, order);
      await trx.commit();

      void this.notifyRepairOrderUpdate(order, {
        title: isUpdate ? "Qo'ng'iroq qabul qilindi" : 'Yangi buyurtma (Telefoniya)',
        message: isUpdate
          ? `Mavjud buyurtma bo'yicha qo'ng'iroq qabul qilindi: #${order.number_id}`
          : `Filialda yangi buyurtma yaratildi (Telefoniya): #${order.number_id}`,
        action: isUpdate ? 'order_updated' : 'order_created',
        openMenu: data.openMenu,
        targetAdminId,
      });

      await this.redisService.flushByPrefix(`${this.table}:${data.branchId}`);
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  async assignTelephonyAdminToExistingOrder(data: {
    branchId: string;
    orderId: string;
    onlinepbxCode: string | null | undefined;
  }): Promise<void> {
    if (!data.onlinepbxCode) return;

    const trx = await this.knex.transaction();
    try {
      const order = await this.getOrderOrThrow(trx, data.orderId);
      if (order.branch_id !== data.branchId) {
        await trx.rollback();
        return;
      }

      const targetAdminId = await this.resolveWebhookAdminId(
        trx,
        data.branchId,
        data.onlinepbxCode,
      );
      if (!targetAdminId) {
        await trx.rollback();
        return;
      }

      await this.assignTelephonyAdminToOrderIfEligible(trx, data.orderId, targetAdminId, {
        assignmentSource: ASSIGNMENT_SOURCE_TELEPHONY_ANSWERED,
      });
      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${data.branchId}`);
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  async notifyAvailableAssignedAdminsForIncomingCall(orderId: string): Promise<void> {
    try {
      const order = await this.knex<RepairOrder>(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order) return;

      const availableAdminIds = await this.findAvailableAssignedAdminIds(orderId);
      if (!availableAdminIds.length) {
        this.logger.log(
          `[Webhook Order] No available assigned admins found for incoming call on repair order ${orderId}.`,
        );
        return;
      }

      const richMeta = await this.helper.getRepairOrderNotificationMeta(order.id, this.knex);
      if (!richMeta) {
        throw new Error(`Failed to fetch notification meta for order ${order.id}`);
      }

      const meta: RepairNotificationMeta = {
        ...richMeta,
        action: 'order_updated',
        open_menu: true,
      };

      this.notificationService.broadcastToAdmins(availableAdminIds, {
        title: "Kiruvchi qo'ng'iroq",
        message: `Buyurtma #${order.number_id} bo'yicha kiruvchi qo'ng'iroq mavjud`,
        type: 'info',
        meta: meta as unknown as Record<string, unknown>,
      });
    } catch (err) {
      this.logger.error(
        `[RepairOrdersService] Failed to notify assigned admins for incoming call on order ${orderId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private isNoAnswerTrackableStatus(status: RepairOrderStatus | null): boolean {
    return status?.type === 'Open' || status?.type === 'Missed';
  }

  private async getRequiredStatusByType(
    trx: Knex.Transaction,
    branchId: string,
    type: 'Open' | 'Missed' | 'Invalid',
  ): Promise<RepairOrderStatus> {
    const status = await trx<RepairOrderStatus>('repair_order_statuses')
      .where({
        branch_id: branchId,
        type,
        status: 'Open',
        is_active: true,
      })
      .orderByRaw('CASE WHEN is_protected THEN 0 ELSE 1 END')
      .orderBy('sort', 'asc')
      .first();

    if (!status) {
      throw new BadRequestException({
        message: `Required repair order status type ${type} is missing`,
        location: 'status_id',
      });
    }

    return status;
  }

  private async getNoAnswerRejectCauseId(trx: Knex.Transaction): Promise<string> {
    const existing = await trx('repair_order_reject_causes')
      .where({ status: 'Open', is_active: true })
      .andWhereRaw('LOWER(name) = LOWER(?)', [NO_ANSWER_REJECT_CAUSE_NAME])
      .first<{ id: string }>('id');

    if (existing?.id) {
      return existing.id;
    }

    const maxSortResult = await trx('repair_order_reject_causes')
      .where({ status: 'Open' })
      .max<{ maxSort: number | null }[]>('sort as maxSort');
    const nextSort = Number(maxSortResult[0]?.maxSort ?? 0) + 1;

    const [created] = await trx('repair_order_reject_causes')
      .insert({
        name: NO_ANSWER_REJECT_CAUSE_NAME,
        description: NO_ANSWER_REJECT_CAUSE_NAME,
        sort: nextSort,
        is_active: true,
        status: 'Open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning<{ id: string }[]>('id');

    return created.id;
  }

  private async moveOrderToStatusAtTop(
    trx: Knex.Transaction,
    order: RepairOrder,
    targetStatusId: string,
  ): Promise<void> {
    if (order.status_id === targetStatusId) {
      await this.moveToTop(trx, order);
      return;
    }

    await this.handleStatusChangeReordering(trx, order, {
      status_id: targetStatusId,
      sort: 1,
    });
  }

  private async logSystemChanges(
    trx: Knex.Transaction,
    orderId: string,
    fields: { key: string; oldVal: unknown; newVal: unknown }[],
  ): Promise<void> {
    const systemAdminId = await this.resolveSystemAdminId(trx);
    if (!systemAdminId) return;

    await this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, fields, systemAdminId);
  }

  private async resolveSystemAdminId(trx: Knex.Transaction): Promise<string | null> {
    const systemAdmin = await trx('admins').where({ id: SYSTEM_ADMIN_ID }).first<{ id: string }>();
    if (systemAdmin?.id) return systemAdmin.id;

    const firstAdmin = await trx('admins')
      .where({ status: 'Open' })
      .orderBy('created_at', 'asc')
      .first<{ id: string }>('id');

    return firstAdmin?.id ?? null;
  }

  private async getOrderOrThrow(
    trx: Knex.Transaction | Knex,
    orderId: string,
  ): Promise<RepairOrder> {
    const order = await trx<RepairOrder>(this.table).where({ id: orderId, status: 'Open' }).first();
    if (!order) {
      throw new NotFoundException({ message: 'Order not found', location: 'repair_order' });
    }
    return order;
  }

  private async resolveWebhookAdminId(
    trx: Knex.Transaction,
    branchId: string,
    onlinepbxCode: string | null | undefined,
  ): Promise<string | null> {
    if (!onlinepbxCode) return null;

    const admin = await trx('admins as a')
      .join('admin_branches as ab', 'a.id', 'ab.admin_id')
      .where({
        'a.onlinepbx_code': onlinepbxCode,
        'a.is_active': true,
        'a.status': 'Open',
        'ab.branch_id': branchId,
      })
      .select('a.id')
      .first<{ id: string }>();

    return admin?.id ?? null;
  }

  private async resolveLeastBusyWebhookAdminId(
    trx: Knex.Transaction,
    branchId: string,
  ): Promise<string | null> {
    const { currentDayStr } = this.getCurrentWorkContext();

    const leastBusyAdmin = await trx('admins')
      .select('admins.id')
      .join('admin_branches as ab', 'admins.id', 'ab.admin_id')
      .leftJoin('repair_order_assign_admins as roaa', 'admins.id', 'roaa.admin_id')
      .leftJoin('repair_orders as ro', (builder) => {
        builder
          .on('roaa.repair_order_id', '=', 'ro.id')
          .andOn('ro.status', '=', trx.raw('?', ['Open']));
      })
      .leftJoin('repair_order_statuses as ros', 'ro.status_id', 'ros.id')
      .where({ 'admins.is_active': true, 'admins.status': 'Open' })
      .andWhere('ab.branch_id', branchId)
      .whereNotNull('admins.onlinepbx_code')
      .andWhereRaw(`NULLIF(BTRIM(admins.onlinepbx_code), '') IS NOT NULL`)
      .andWhereRaw(`(admins.work_days->>?)::boolean = true`, [currentDayStr])
      .groupBy('admins.id')
      // Count only repair orders whose workflow status is still non-terminal.
      .orderByRaw(
        `COUNT(CASE WHEN ros.status = ? AND ros.is_active = true AND (ros.type IS NULL OR ros.type NOT IN (?, ?, ?, ?)) THEN 1 END) ASC`,
        ['Open', ...Array.from(this.terminalStatusTypes)],
      )
      .first<{ id: string }>();

    return leastBusyAdmin?.id ?? null;
  }

  private async assignFallbackAdminIfOrderHasNone(
    trx: Knex.Transaction,
    orderId: string,
    branchId: string,
  ): Promise<string | null> {
    const existingAssignment = await trx('repair_order_assign_admins')
      .where({ repair_order_id: orderId })
      .first<{ admin_id: string }>('admin_id');

    if (existingAssignment) return existingAssignment.admin_id;

    const assignedAdminId = await this.resolveLeastBusyWebhookAdminId(trx, branchId);
    if (!assignedAdminId) {
      this.logger.log(`[Webhook Order] No fallback admin available for repair order ${orderId}`);
      return null;
    }

    this.logger.log(
      `[Webhook Order] Assigning repair order ${orderId} to fallback admin ${assignedAdminId}`,
    );
    await this.assignTelephonyAdminToOrderIfEligible(trx, orderId, assignedAdminId, {
      assignmentSource: ASSIGNMENT_SOURCE_TELEPHONY_AUTO,
    });
    return assignedAdminId;
  }

  private async assignAdminToOrderIfNeeded(
    trx: Knex.Transaction,
    orderId: string,
    adminId: string,
    assignmentSource: RepairOrderAssignmentSource,
  ): Promise<void> {
    await trx('repair_order_assign_admins')
      .insert({
        repair_order_id: orderId,
        admin_id: adminId,
        assignment_source: assignmentSource,
        created_at: new Date(),
      })
      .onConflict(['repair_order_id', 'admin_id'])
      .ignore();

    if (assignmentSource === ASSIGNMENT_SOURCE_TELEPHONY_AUTO) return;

    await trx('repair_order_assign_admins')
      .where({ repair_order_id: orderId, admin_id: adminId })
      .whereIn('assignment_source', AUTO_REPLACEABLE_ASSIGNMENT_SOURCES)
      .update({ assignment_source: assignmentSource });
  }

  private async assignTelephonyAdminToOrderIfEligible(
    trx: Knex.Transaction,
    orderId: string,
    adminId: string,
    options: {
      replaceAutoAssignedSameRole?: boolean;
      assignmentSource?: RepairOrderAssignmentSource;
    } = {},
  ): Promise<void> {
    const assignmentSource = options.assignmentSource ?? ASSIGNMENT_SOURCE_TELEPHONY_ANSWERED;

    if (options.replaceAutoAssignedSameRole) {
      await this.removeAutoAssignedAdminsWithSameRole(trx, orderId, adminId);
    }

    const hasSameRoleAssigned = await this.hasAssignedAdminWithSameRole(trx, orderId, adminId);
    if (hasSameRoleAssigned) {
      this.logger.log(
        `[Webhook Order] Skipping telephony assignment of admin ${adminId} to repair order ${orderId} because an assigned admin already has the same role.`,
      );
      return;
    }

    await this.assignAdminToOrderIfNeeded(trx, orderId, adminId, assignmentSource);
  }

  private async removeAutoAssignedAdminsWithSameRole(
    trx: Knex.Transaction,
    orderId: string,
    adminId: string,
  ): Promise<number> {
    const roles = await this.getActiveRolesByAdminId(trx, adminId);
    if (!roles.length) return 0;

    const roleIds = roles.map((role) => role.role_id);
    const roleNames = [
      ...new Set(
        roles.map((role) => this.normalizeRoleName(role.role_name)).filter((name) => name),
      ),
    ];

    const deletedCount = await trx('repair_order_assign_admins as raa')
      .join('admin_roles as ar', 'raa.admin_id', 'ar.admin_id')
      .join('roles as r', 'ar.role_id', 'r.id')
      .where('raa.repair_order_id', orderId)
      .whereNot('raa.admin_id', adminId)
      .whereIn('raa.assignment_source', AUTO_REPLACEABLE_ASSIGNMENT_SOURCES)
      .andWhere((qb) => {
        void qb.whereIn('ar.role_id', roleIds);
        if (roleNames.length) {
          void qb.orWhereRaw('LOWER(BTRIM(r.name)) = ANY(?::text[])', [roleNames]);
        }
      })
      .andWhere('r.status', 'Open')
      .andWhere('r.is_active', true)
      .delete();

    return Number(deletedCount ?? 0);
  }

  private async hasAssignedAdminWithSameRole(
    trx: Knex.Transaction,
    orderId: string,
    adminId: string,
  ): Promise<boolean> {
    const roles = await this.getActiveRolesByAdminId(trx, adminId);
    if (!roles.length) return false;

    const roleIds = roles.map((role) => role.role_id);
    const roleNames = [
      ...new Set(
        roles.map((role) => this.normalizeRoleName(role.role_name)).filter((name) => name),
      ),
    ];

    const existingMatch = await trx('repair_order_assign_admins as raa')
      .join('admin_roles as ar', 'raa.admin_id', 'ar.admin_id')
      .join('roles as r', 'ar.role_id', 'r.id')
      .where('raa.repair_order_id', orderId)
      .whereNot('raa.admin_id', adminId)
      .andWhere((qb) => {
        void qb.whereIn('ar.role_id', roleIds);
        if (roleNames.length) {
          void qb.orWhereRaw('LOWER(BTRIM(r.name)) = ANY(?::text[])', [roleNames]);
        }
      })
      .andWhere('r.status', 'Open')
      .andWhere('r.is_active', true)
      .first();

    return !!existingMatch;
  }

  private async getActiveRolesByAdminId(
    trx: Knex.Transaction,
    adminId: string,
  ): Promise<{ role_id: string; role_name: string }[]> {
    return trx('admin_roles as ar')
      .join('roles as r', 'ar.role_id', 'r.id')
      .where('ar.admin_id', adminId)
      .andWhere('r.status', 'Open')
      .andWhere('r.is_active', true)
      .select('ar.role_id', 'r.name as role_name');
  }

  private normalizeRoleName(roleName: string | null | undefined): string {
    return roleName?.trim().toLowerCase() ?? '';
  }

  private async findAvailableAssignedAdminIds(orderId: string): Promise<string[]> {
    const { currentDayStr, currentHHmm } = this.getCurrentWorkContext();

    return this.knex('repair_order_assign_admins as raa')
      .join('admins as a', 'raa.admin_id', 'a.id')
      .where('raa.repair_order_id', orderId)
      .andWhere('a.is_active', true)
      .andWhere('a.status', 'Open')
      .whereRaw(`(a.work_days->>?)::boolean = true`, [currentDayStr])
      .andWhere('a.work_start_time', '<=', currentHHmm)
      .andWhere('a.work_end_time', '>=', currentHHmm)
      .pluck('a.id');
  }

  private getCurrentWorkContext(now: Date = new Date()): {
    currentDayStr: string;
    currentHHmm: string;
  } {
    const currentDayIndex = now.getDay();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    return {
      currentDayStr: days[currentDayIndex],
      currentHHmm: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  }

  private normalizeDescription(description?: string | null): string | null | undefined {
    if (description === undefined) {
      return undefined;
    }

    if (description === null) {
      return null;
    }

    const normalized = description.trim();
    return normalized.length ? normalized : null;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    return formatUzPhoneToE164(phoneNumber);
  }

  private getPhoneLookupCandidates(phoneNumber: string): string[] {
    return getUzPhoneLookupCandidates(phoneNumber);
  }

  private async normalizeExistingUserPhoneIfNeeded(
    trx: Knex.Transaction,
    user: Pick<User, 'id' | 'phone_number1'>,
    normalizedPhone: string,
  ): Promise<void> {
    if (!user.phone_number1 || user.phone_number1 === normalizedPhone) {
      return;
    }

    const conflictingUser = await trx<User>('users')
      .where({ phone_number1: normalizedPhone })
      .whereNot({ id: user.id })
      .first();

    if (conflictingUser) {
      return;
    }

    await trx('users').where({ id: user.id }).update({
      phone_number1: normalizedPhone,
      updated_at: new Date().toISOString(),
    });
  }

  private buildTelephonyWorkflowOpenOrderQuery(db: Knex | Knex.Transaction): Knex.QueryBuilder {
    return db<RepairOrder>(`${this.table} as ro`)
      .select('ro.*')
      .join('repair_order_statuses as ros', 'ro.status_id', 'ros.id')
      .whereNotIn('ro.status', ['Cancelled', 'Deleted', 'Closed'])
      .andWhere({
        'ros.status': 'Open',
        'ros.is_active': true,
      })
      .andWhere((qb): void => {
        void qb
          .whereNull('ros.type')
          .orWhereNotIn('ros.type', Array.from(this.terminalStatusTypes))
          .orWhereRaw(
            `
            ros.type = ?
            AND COALESCE(
              (
                SELECT MAX(h.created_at)
                FROM repair_order_change_histories h
                WHERE h.repair_order_id = ro.id
                  AND h.field = 'status_id'
                  AND h.new_value #>> '{}' = ro.status_id::text
              ),
              ro.updated_at,
              ro.created_at
            ) >= NOW() - (? * INTERVAL '1 hour')
          `,
            ['Invalid', this.telephonyInvalidReuseWindowHours],
          );
      });
  }

  private async getTransitionRule(
    trx: Knex.Transaction,
    fromStatusId: string,
    toStatusId: string,
    branchId: string,
    roleId?: string,
  ): Promise<{ from_status_id: string; to_status_id: string } | null> {
    const useRoleScope = roleId
      ? await this.hasRoleScopedTransitions(trx, branchId, roleId)
      : false;

    let query = trx<{ from_status_id: string; to_status_id: string }>(
      'repair-order-status-transitions',
    ).where({ from_status_id: fromStatusId, to_status_id: toStatusId });

    if (useRoleScope && roleId) {
      query = query.andWhere('role_id', roleId);
    } else {
      query = query.andWhere('role_id', null);
    }

    const rule = await query.first();
    return rule || null;
  }

  private async hasRoleScopedTransitions(
    trx: Knex.Transaction,
    branchId: string,
    roleId: string,
  ): Promise<boolean> {
    const row = await trx('repair-order-status-transitions as transition')
      .join('repair_order_statuses as from_status', 'transition.from_status_id', 'from_status.id')
      .where('transition.role_id', roleId)
      .andWhere('from_status.branch_id', branchId)
      .andWhere('from_status.status', 'Open')
      .first<{ id: string }>('transition.id');

    return Boolean(row);
  }

  private async getStatusDetails(
    trx: Knex.Transaction,
    statusId: string,
  ): Promise<RepairOrderStatus | null> {
    const status = await trx<RepairOrderStatus>('repair_order_statuses')
      .where({ id: statusId })
      .first();
    return status || null;
  }

  private async getActiveRental(
    trx: Knex.Transaction,
    orderId: string,
  ): Promise<{ id: string } | null> {
    const rental = await trx('repair_order_rental_phones')
      .where({ repair_order_id: orderId, status: 'Active' })
      .first();
    return (rental as { id: string }) || null;
  }

  private async hasServiceForm(trx: Knex.Transaction, orderId: string): Promise<boolean> {
    const serviceForm = await trx('service_forms')
      .where({ repair_order_id: orderId })
      .first<{ id: string }>('id');

    return !!serviceForm;
  }

  private getPrimaryRoleOrThrow(admin: AdminPayload): { name: string; id: string } {
    const primaryRole = admin.roles[0];

    if (!primaryRole) {
      throw new ForbiddenException({
        message: 'No primary role assigned for transition validation',
        location: 'status_id',
      });
    }

    return primaryRole;
  }

  private isSuperAdmin(admin: AdminPayload): boolean {
    return admin.roles.some((role) => role.name.trim().toLowerCase() === 'super admin');
  }

  private getTargetStatusPermissionOrThrow(
    admin: AdminPayload,
    permissions: RepairOrderStatusPermission[],
    branchId: string,
    targetStatusId: string,
  ): RepairOrderStatusPermission {
    const primaryRole = this.getPrimaryRoleOrThrow(admin);
    const targetPermission = permissions.find(
      (permission) =>
        permission.role_id === primaryRole.id &&
        permission.branch_id === branchId &&
        permission.status_id === targetStatusId,
    );

    if (!targetPermission) {
      throw new ForbiddenException({
        message:
          "Tanlangan status uchun sizning asosiy rolingizga ruxsat sozlanmagan. Buyurtmani bu statusga ko'chirib bo'lmaydi.",
        location: 'status_id',
      });
    }

    return targetPermission;
  }

  private async validateStatusTransitionOrThrow(
    trx: Knex.Transaction,
    admin: AdminPayload,
    order: RepairOrder,
    targetStatusId: string,
    permissions: RepairOrderStatusPermission[],
    orderId: string,
    transitionRule?: { from_status_id: string; to_status_id: string } | null,
    targetStatus?: RepairOrderStatus | null,
    activeRental?: { id: string } | null,
  ): Promise<RepairOrderStatusPermission> {
    const resolvedTransitionRule =
      transitionRule ??
      (await this.getTransitionRule(
        trx,
        order.status_id,
        targetStatusId,
        order.branch_id,
        admin.roles[0]?.id,
      ));

    if (!resolvedTransitionRule) {
      throw new BadRequestException({
        message: "Buyurtmani tanlangan statusga ko'chirishga ruxsat berilmagan.",
        location: 'status_id',
      });
    }

    const resolvedTargetStatus = targetStatus ?? (await this.getStatusDetails(trx, targetStatusId));
    const resolvedActiveRental = activeRental ?? (await this.getActiveRental(trx, orderId));

    if (
      resolvedTargetStatus &&
      resolvedTargetStatus.type &&
      this.terminalStatusTypes.has(resolvedTargetStatus.type) &&
      resolvedActiveRental
    ) {
      throw new BadRequestException({
        message:
          "Aktiv ijaradagi telefon mavjud bo'lgani uchun buyurtmani ushbu statusga ko'chirib bo'lmaydi.",
        location: 'status_id',
      });
    }

    const targetPermission = this.getTargetStatusPermissionOrThrow(
      admin,
      permissions,
      order.branch_id,
      targetStatusId,
    );

    if (targetPermission.cannot_continue_without_imei && !order.imei) {
      throw new BadRequestException({
        message: "Ushbu statusga o'tish uchun IMEI kiritilishi shart.",
        location: 'imei',
      });
    }

    if (targetPermission.cannot_continue_without_reject_cause && !order.reject_cause_id) {
      throw new BadRequestException({
        message: "Ushbu statusga o'tish uchun rad etish sababi tanlanishi shart.",
        location: 'reason_for_rejection',
      });
    }

    if (targetPermission.cannot_continue_without_agreed_date && !order.agreed_date) {
      throw new BadRequestException({
        message: "Ushbu statusga o'tish uchun kelishilgan sana kiritilishi shart.",
        location: 'agreed_date',
      });
    }

    if (targetPermission.cannot_continue_without_service_form) {
      const hasServiceForm = await this.hasServiceForm(trx, orderId);
      if (!hasServiceForm) {
        throw new BadRequestException({
          message: "Ushbu statusga o'tish uchun servis formasi yaratilishi shart.",
          location: 'service_form',
        });
      }
    }

    return targetPermission;
  }

  private async handleStatusChangeReordering(
    trx: Knex.Transaction,
    order: RepairOrder,
    dto: MoveRepairOrderDto,
  ): Promise<void> {
    // Shift orders in the old status up to maintain contiguity
    await trx(this.table)
      .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
      .andWhere('sort', '>', order.sort)
      .decrement('sort', 1);

    const targetSort = dto.sort || 1;
    // Shift orders in the new status down to make room
    await trx(this.table)
      .where({ branch_id: order.branch_id, status_id: dto.status_id, status: 'Open' })
      .andWhere('sort', '>=', targetSort)
      .increment('sort', 1);
  }

  private async handleSameStatusReordering(
    trx: Knex.Transaction,
    order: RepairOrder,
    newSort: number,
  ): Promise<void> {
    if (newSort < order.sort) {
      await trx(this.table)
        .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
        .andWhere('sort', '>=', newSort)
        .andWhere('sort', '<', order.sort)
        .update({ sort: this.knex.raw('sort + 1') });
    } else {
      await trx(this.table)
        .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
        .andWhere('sort', '<=', newSort)
        .andWhere('sort', '>', order.sort)
        .update({ sort: this.knex.raw('sort - 1') });
    }
  }

  private async getProblemHistorySnapshot(
    trx: Knex.Transaction,
    repairOrderId: string,
    problemType: 'initial' | 'final',
  ): Promise<
    Array<{
      problem_category_id: string;
      price: string;
      estimated_minutes: number;
      parts: Array<{
        repair_part_id: string;
        quantity: number;
        part_price: string;
      }>;
    }>
  > {
    const problemTableName =
      problemType === 'initial' ? 'repair_order_initial_problems' : 'repair_order_final_problems';
    const problemIdColumn =
      problemType === 'initial'
        ? 'repair_order_initial_problem_id'
        : 'repair_order_final_problem_id';

    const problems = await trx<{
      id: string;
      repair_order_id: string;
      problem_category_id: string;
      price: string;
      estimated_minutes: number;
    }>(problemTableName)
      .where({ repair_order_id: repairOrderId })
      .select('id', 'problem_category_id', 'price', 'estimated_minutes')
      .orderBy('created_at', 'asc');

    const problemIds = problems.map((problem) => problem.id);
    const partsByProblemId = new Map<
      string,
      Array<{ repair_part_id: string; quantity: number; part_price: string }>
    >();

    if (problemIds.length) {
      const parts = await trx<Record<string, string | number>>('repair_order_parts')
        .where({ repair_order_id: repairOrderId })
        .whereIn(problemIdColumn, problemIds)
        .select(problemIdColumn, 'repair_part_id', 'quantity', 'part_price')
        .orderBy('created_at', 'asc');

      for (const part of parts) {
        const key = String(part[problemIdColumn]);
        const current = partsByProblemId.get(key) ?? [];
        current.push({
          repair_part_id: String(part.repair_part_id),
          quantity: Number(part.quantity),
          part_price: String(part.part_price),
        });
        partsByProblemId.set(key, current);
      }
    }

    return problems.map((problem) => ({
      problem_category_id: String(problem.problem_category_id),
      price: String(problem.price),
      estimated_minutes: Number(problem.estimated_minutes),
      parts: partsByProblemId.get(String(problem.id)) ?? [],
    }));
  }

  private emitMoveNotification(order: RepairOrder, toStatusId: string): void {
    void this.notifyRepairOrderUpdate(order, {
      title: 'Buyurtma holati o‘zgardi',
      message: `Buyurtma #${order.number_id} yangi statusga o'tdi`,
      action: 'status_changed',
      fromStatusId: order.status_id,
      toStatusId,
    });
  }
}
