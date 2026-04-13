import type { Knex } from 'knex';
import type { RepairOrderChangeHistory } from 'src/common/types/repair-order-change-history.interface';

export interface HistoryCommentLogger {
  log?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
  debug?: (message: string) => void;
}

type DbClient = Knex | Knex.Transaction;

type NameLookupRow = {
  id: string;
  name_uz?: string | null;
  name_ru?: string | null;
  name_en?: string | null;
  part_name_uz?: string | null;
  part_name_ru?: string | null;
  part_name_en?: string | null;
  name?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  phone_number1?: string | null;
  brand?: string | null;
  model?: string | null;
  imei?: string | null;
};

const DEFAULT_SYSTEM_ADMIN_ID = '00000000-0000-4000-8000-000000000000';

const FIELD_LABELS: Record<string, string> = {
  status_id: 'Holat',
  status: 'Holat',
  branch_id: 'Filial',
  name: 'Mijoz nomi',
  phone_number: 'Telefon raqami',
  priority: 'Muhimlik darajasi',
  phone_category_id: 'Qurilma modeli',
  region_id: 'Hudud',
  imei: 'IMEI',
  agreed_date: 'Kelishilgan sana',
  source: 'Murojaat manbasi',
  reject_cause_id: 'Rad etish sababi',
  user_id: 'Mijoz',
  sort: 'Navbat tartibi',
  admin_ids: "Mas'ul xodimlar",
  initial_problems: "Boshlang'ich muammolar",
  final_problems: 'Yakuniy muammolar',
  pickup: "Olib ketish ma'lumoti",
  delivery: "Yetkazib berish ma'lumoti",
  rental_phone: 'Ijara telefoni',
  comments: 'Izoh',
  repair_order_parts: 'Ehtiyot qismlar',
};

const PRIORITY_LABELS: Record<string, string> = {
  Low: 'Past',
  Medium: "O'rtacha",
  High: 'Yuqori',
  Highest: 'Juda yuqori',
};

const SOURCE_LABELS: Record<string, string> = {
  Telegram: 'Telegram',
  Meta: 'Meta',
  Qolda: "Qo'lda",
  Boshqa: 'Boshqa',
  'Kiruvchi qongiroq': "Kiruvchi qo'ng'iroq",
  'Chiquvchi qongiroq': "Chiquvchi qo'ng'iroq",
  Organic: 'Organik',
};

const PICKUP_METHOD_LABELS: Record<string, string> = {
  Self: "O'zi olib ketadi",
  Pickup: 'Olib ketish xizmati',
};

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  Self: "O'zi olib ketadi",
  Delivery: 'Yetkazib berish',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  Open: 'Faol',
  Deleted: "O'chirilgan",
  Closed: 'Yopilgan',
  Cancelled: 'Bekor qilingan',
  Canceled: 'Bekor qilingan',
};

const RENTAL_STATUS_LABELS: Record<string, string> = {
  Pending: 'Kutilmoqda',
  Active: 'Faol',
  Returned: 'Qaytarilgan',
  Cancelled: 'Bekor qilingan',
};

const CURRENCY_LABELS: Record<string, string> = {
  UZS: "so'm",
  USD: 'USD',
  EUR: 'EUR',
};

export class RepairOrderHistoryCommentManager {
  private readonly lookupCache = new Map<string, string | null>();

  constructor(
    private readonly knex: Knex,
    private readonly logger?: HistoryCommentLogger,
  ) {}

  async buildCommentText(trx: DbClient, history: RepairOrderChangeHistory): Promise<string | null> {
    switch (history.field) {
      case 'status_id':
      case 'status':
      case 'branch_id':
      case 'name':
      case 'phone_number':
      case 'priority':
      case 'phone_category_id':
      case 'region_id':
      case 'imei':
      case 'agreed_date':
      case 'source':
      case 'reject_cause_id':
      case 'user_id':
      case 'sort':
        return this.formatScalarDiff(trx, history.field, history.old_value, history.new_value);
      case 'admin_ids':
        return this.formatAdminDiff(trx, history.old_value, history.new_value);
      case 'initial_problems':
      case 'final_problems':
        return this.formatProblemDiff(trx, history.field, history.old_value, history.new_value);
      case 'pickup':
      case 'delivery':
        return this.formatRouteDiff(trx, history.field, history.old_value, history.new_value);
      case 'rental_phone':
        return this.formatRentalDiff(trx, history.old_value, history.new_value);
      case 'comments':
        return this.formatCommentDiff(history.old_value, history.new_value);
      case 'repair_order_parts':
        return this.formatRepairPartsDiff(trx, history.old_value, history.new_value);
      case 'branch_transferred':
        return this.formatLegacyBranchTransfer(trx, history.new_value);
      case 'attachment_uploaded':
      case 'attachment_deleted':
      case 'product_updated':
      case 'problem_updated':
      case 'rental_phone_updated':
      case 'rental_phone_removed':
        return this.formatLegacyAction(trx, history.field, history.new_value);
      default:
        return null;
    }
  }

  async ensureCommentForHistory(
    trx: DbClient,
    history: RepairOrderChangeHistory,
  ): Promise<boolean> {
    const existing = await trx('repair_order_comments')
      .where({ history_change_id: history.id })
      .first('id');

    if (existing) {
      return false;
    }

    const text = await this.buildCommentText(trx, history);
    if (!text) {
      return false;
    }

    const createdBy = await this.resolveCommentCreatorId(trx, history.created_by);
    const statusBy = await this.resolveStatusBy(trx, history);

    if (!statusBy) {
      this.logger?.warn?.(
        `[HistoryComment] Status could not be resolved for history ${history.id}, skipping comment generation.`,
      );
      return false;
    }

    await trx('repair_order_comments')
      .insert({
        repair_order_id: history.repair_order_id,
        text,
        status: 'Open',
        comment_type: 'history',
        history_change_id: history.id,
        created_by: createdBy,
        status_by: statusBy,
        created_at: history.created_at,
        updated_at: history.created_at,
      })
      .onConflict('history_change_id')
      .ignore();

    return true;
  }

  async backfillMissingComments(batchSize = 200): Promise<{
    processed: number;
    created: number;
    skipped: number;
  }> {
    let processed = 0;
    let created = 0;
    let skipped = 0;
    let lastCreatedAt: Date | string | null = null;
    let lastId: string | null = null;

    while (true) {
      const rows = await this.fetchMissingHistoryRows(batchSize, lastCreatedAt, lastId);
      if (!rows.length) break;

      await this.knex.transaction(async (trx) => {
        for (const row of rows) {
          processed += 1;
          const wasCreated = await this.ensureCommentForHistory(trx, row);
          if (wasCreated) {
            created += 1;
          } else {
            skipped += 1;
          }
        }
      });

      const lastRow = rows[rows.length - 1];
      lastCreatedAt = lastRow.created_at;
      lastId = lastRow.id;

      if (rows.length < batchSize) break;
    }

    return { processed, created, skipped };
  }

  private async fetchMissingHistoryRows(
    batchSize: number,
    lastCreatedAt: Date | string | null,
    lastId: string | null,
  ): Promise<RepairOrderChangeHistory[]> {
    const query = this.knex('repair_order_change_histories as h')
      .leftJoin('repair_order_comments as c', 'c.history_change_id', 'h.id')
      .whereNull('c.history_change_id')
      .select<RepairOrderChangeHistory[]>('h.*')
      .orderBy('h.created_at', 'asc')
      .orderBy('h.id', 'asc')
      .limit(batchSize);

    if (lastCreatedAt && lastId) {
      void query.andWhere((builder) => {
        void builder.where('h.created_at', '>', lastCreatedAt).orWhere((inner) => {
          void inner.where('h.created_at', '=', lastCreatedAt).andWhere('h.id', '>', lastId);
        });
      });
    }

    return query;
  }

  private async formatScalarDiff(
    trx: DbClient,
    field: string,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<string | null> {
    const label = FIELD_LABELS[field] ?? 'Maydon';
    const oldDisplay = await this.resolveFieldDisplayValue(trx, field, oldValue);
    const newDisplay = await this.resolveFieldDisplayValue(trx, field, newValue);

    if (oldDisplay && newDisplay) {
      return `${label} o'zgardi: "${oldDisplay}" -> "${newDisplay}"`;
    }

    if (!oldDisplay && newDisplay) {
      return `${label} belgilandi: "${newDisplay}"`;
    }

    if (oldDisplay && !newDisplay) {
      return `${label} olib tashlandi: "${oldDisplay}"`;
    }

    return null;
  }

  private async formatAdminDiff(
    trx: DbClient,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<string | null> {
    const oldIds = this.asStringArray(oldValue);
    const newIds = this.asStringArray(newValue);
    const oldNames = await this.resolveAdminNames(trx, oldIds);
    const newNames = await this.resolveAdminNames(trx, newIds);
    const added = newNames.filter((name) => !oldNames.includes(name));
    const removed = oldNames.filter((name) => !newNames.includes(name));

    if (added.length && !removed.length) {
      return `Mas'ul xodimlar qo'shildi: "${this.joinLimited(added)}"`;
    }

    if (removed.length && !added.length) {
      return `Mas'ul xodimlar olib tashlandi: "${this.joinLimited(removed)}"`;
    }

    if (oldNames.length || newNames.length) {
      return `Mas'ul xodimlar o'zgardi: "${this.joinLimited(oldNames)}" -> "${this.joinLimited(newNames)}"`;
    }

    return null;
  }

  private async formatProblemDiff(
    trx: DbClient,
    field: 'initial_problems' | 'final_problems',
    oldValue: unknown,
    newValue: unknown,
  ): Promise<string | null> {
    const label = FIELD_LABELS[field];
    const oldDisplay = await this.summarizeProblems(trx, oldValue);
    const newDisplay = await this.summarizeProblems(trx, newValue);

    if (oldDisplay && newDisplay && oldDisplay === newDisplay) {
      return `${label} yangilandi`;
    }

    if (oldDisplay && newDisplay) {
      return `${label} o'zgardi: "${oldDisplay}" -> "${newDisplay}"`;
    }

    if (!oldDisplay && newDisplay) {
      return `${label} belgilandi: "${newDisplay}"`;
    }

    if (oldDisplay && !newDisplay) {
      return `${label} olib tashlandi: "${oldDisplay}"`;
    }

    return null;
  }

  private async formatRepairPartsDiff(
    trx: DbClient,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<string | null> {
    const label = FIELD_LABELS.repair_order_parts;
    const oldDisplay = await this.summarizeProblemParts(trx, oldValue);
    const newDisplay = await this.summarizeProblemParts(trx, newValue);

    if (oldDisplay && newDisplay && oldDisplay === newDisplay) {
      return `${label} yangilandi`;
    }

    if (oldDisplay && newDisplay) {
      return `${label} o'zgardi: "${oldDisplay}" -> "${newDisplay}"`;
    }

    if (!oldDisplay && newDisplay) {
      return `${label} qo'shildi: "${newDisplay}"`;
    }

    if (oldDisplay && !newDisplay) {
      return `${label} olib tashlandi: "${oldDisplay}"`;
    }

    return null;
  }

  private async formatRouteDiff(
    trx: DbClient,
    field: 'pickup' | 'delivery',
    oldValue: unknown,
    newValue: unknown,
  ): Promise<string | null> {
    const label = FIELD_LABELS[field];
    const oldDisplay = await this.summarizeRoute(trx, oldValue);
    const newDisplay = await this.summarizeRoute(trx, newValue);

    if (oldDisplay && newDisplay && oldDisplay === newDisplay) {
      return `${label} yangilandi`;
    }

    if (oldDisplay && newDisplay) {
      return `${label} o'zgardi: "${oldDisplay}" -> "${newDisplay}"`;
    }

    if (!oldDisplay && newDisplay) {
      return `${label} qo'shildi: "${newDisplay}"`;
    }

    if (oldDisplay && !newDisplay) {
      return `${label} olib tashlandi: "${oldDisplay}"`;
    }

    return null;
  }

  private async formatRentalDiff(
    trx: DbClient,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<string | null> {
    const label = FIELD_LABELS.rental_phone;
    const oldDisplay = await this.summarizeRental(trx, oldValue);
    const newDisplay = await this.summarizeRental(trx, newValue);

    if (oldDisplay && newDisplay && oldDisplay === newDisplay) {
      return `${label} yangilandi`;
    }

    if (oldDisplay && newDisplay) {
      return `${label} o'zgardi: "${oldDisplay}" -> "${newDisplay}"`;
    }

    if (!oldDisplay && newDisplay) {
      return `${label} belgilandi: "${newDisplay}"`;
    }

    if (oldDisplay && !newDisplay) {
      return `${label} olib tashlandi: "${oldDisplay}"`;
    }

    return null;
  }

  private formatCommentDiff(oldValue: unknown, newValue: unknown): string | null {
    if (Array.isArray(newValue) && oldValue == null) {
      return null;
    }

    if (typeof oldValue === 'string' && typeof newValue === 'string') {
      return `Izoh o'zgardi: "${oldValue}" -> "${newValue}"`;
    }

    if (typeof oldValue === 'string' && newValue == null) {
      return `Izoh o'chirildi: "${oldValue}"`;
    }

    if (oldValue === 'deleted') {
      return `Izoh o'chirildi`;
    }

    return null;
  }

  private async formatLegacyBranchTransfer(
    trx: DbClient,
    payload: unknown,
  ): Promise<string | null> {
    if (!this.isRecord(payload)) return null;

    return this.formatScalarDiff(
      trx,
      'branch_id',
      payload.old_branch_id ?? null,
      payload.new_branch_id ?? null,
    );
  }

  private async formatLegacyAction(
    trx: DbClient,
    action: string,
    payload: unknown,
  ): Promise<string | null> {
    if (!this.isRecord(payload) && action !== 'rental_phone_removed') {
      return null;
    }

    const data = this.isRecord(payload) ? payload : {};

    switch (action) {
      case 'attachment_uploaded':
        return data.file_name ? `Fayl qo'shildi: "${String(data.file_name)}"` : `Fayl qo'shildi`;
      case 'attachment_deleted':
        return data.file_name ? `Fayl o'chirildi: "${String(data.file_name)}"` : `Fayl o'chirildi`;
      case 'product_updated': {
        const details: string[] = [];
        if (data.phone_category_id) {
          const category = await this.resolvePhoneCategoryName(trx, String(data.phone_category_id));
          if (category) details.push(`model "${category}"`);
        }
        if (data.imei) {
          details.push(`IMEI "${String(data.imei)}"`);
        }
        return details.length
          ? `Qurilma ma'lumoti yangilandi: ${details.join(', ')}`
          : `Qurilma ma'lumoti yangilandi`;
      }
      case 'problem_updated': {
        const category = data.problem_category_id
          ? await this.resolveProblemCategoryName(trx, String(data.problem_category_id))
          : null;

        if (category) {
          return `Muammo ma'lumoti yangilandi: "${category}"`;
        }

        return `Muammo ma'lumoti yangilandi`;
      }
      case 'rental_phone_updated': {
        const summary = await this.summarizeRental(trx, data);
        return summary
          ? `Ijara telefoni ma'lumoti yangilandi: "${summary}"`
          : `Ijara telefoni ma'lumoti yangilandi`;
      }
      case 'rental_phone_removed':
        return `Ijara telefoni olib tashlandi`;
      default:
        return null;
    }
  }

  private async resolveFieldDisplayValue(
    trx: DbClient,
    field: string,
    value: unknown,
  ): Promise<string | null> {
    if (value == null) return null;

    switch (field) {
      case 'status_id':
        return this.resolveStatusName(trx, this.asString(value));
      case 'branch_id':
        return this.resolveBranchName(trx, this.asString(value));
      case 'phone_category_id':
        return this.resolvePhoneCategoryName(trx, this.asString(value));
      case 'reject_cause_id':
        return this.resolveRejectCauseName(trx, this.asString(value));
      case 'region_id':
        return this.resolveRegionTitle(trx, this.asString(value));
      case 'user_id':
        return this.resolveUserLabel(trx, this.asString(value));
      case 'priority':
        return PRIORITY_LABELS[this.asString(value)] ?? this.safeDisplayText(value);
      case 'pickup_method':
        return PICKUP_METHOD_LABELS[this.asString(value)] ?? this.safeDisplayText(value);
      case 'delivery_method':
        return DELIVERY_METHOD_LABELS[this.asString(value)] ?? this.safeDisplayText(value);
      case 'source':
        return SOURCE_LABELS[this.asString(value)] ?? this.safeDisplayText(value);
      case 'status':
        return ORDER_STATUS_LABELS[this.asString(value)] ?? this.safeDisplayText(value);
      case 'agreed_date':
        return this.formatDateTime(value);
      default:
        return this.safeDisplayText(value);
    }
  }

  private async summarizeProblems(trx: DbClient, value: unknown): Promise<string | null> {
    const items = Array.isArray(value) ? value : [];
    if (!items.length) return null;

    const parts = await Promise.all(
      items.map(async (item) => {
        if (!this.isRecord(item)) return null;

        const categoryId = this.asString(item.problem_category_id);
        const category = categoryId ? await this.resolveProblemCategoryName(trx, categoryId) : null;
        if (!category) return null;

        const segments = [category];
        const price = this.formatMoney(item.price);
        const minutes = this.formatMinutes(item.estimated_minutes);
        const partsSummary = await this.summarizeProblemParts(trx, item.parts);

        if (price) segments.push(price);
        if (minutes) segments.push(minutes);
        if (partsSummary) segments.push(`Qismlar: ${partsSummary}`);

        return segments.join(', ');
      }),
    );

    const filtered = parts.filter((item): item is string => Boolean(item));
    return filtered.length ? this.joinLimited(filtered) : null;
  }

  private async summarizeProblemParts(trx: DbClient, value: unknown): Promise<string | null> {
    const items = Array.isArray(value) ? value : [];
    if (!items.length) return null;

    const parts = await Promise.all(
      items.map(async (item) => {
        if (!this.isRecord(item)) return null;

        const partId = this.asString(item.repair_part_id ?? item.id);
        const partName = (await this.resolveRepairPartName(trx, partId)) ?? "Noma'lum qism";
        const segments = [partName];
        const quantity = this.formatQuantity(item.quantity);
        const price = this.formatMoney(item.part_price);

        if (quantity) segments.push(quantity);
        if (price) segments.push(price);

        return segments.join(', ');
      }),
    );

    const filtered = parts.filter((item): item is string => Boolean(item));
    return filtered.length ? this.joinLimited(filtered) : null;
  }

  private async summarizeRoute(trx: DbClient, value: unknown): Promise<string | null> {
    if (!this.isRecord(value)) return null;

    const parts: string[] = [];
    const courierId = this.asString(value.courier_id);

    if (courierId) {
      const courier = await this.resolveAdminName(trx, courierId);
      if (courier) parts.push(`Kuryer: ${courier}`);
    }

    if (typeof value.description === 'string' && value.description.trim()) {
      parts.push(`Izoh: ${value.description.trim()}`);
    }

    if ((value.lat || value.long) && parts.length === 0) {
      parts.push('Lokatsiya kiritildi');
    }

    return parts.length ? parts.join(', ') : null;
  }

  private async summarizeRental(trx: DbClient, value: unknown): Promise<string | null> {
    if (!this.isRecord(value)) return null;

    const parts: string[] = [];
    const deviceId = this.asString(value.rental_phone_device_id ?? value.rental_phone_id);

    if (deviceId) {
      const device = await this.resolveRentalPhoneDeviceLabel(trx, deviceId);
      if (device) parts.push(device);
    }

    const status = this.asString(value.status);
    if (status && RENTAL_STATUS_LABELS[status]) {
      parts.push(`Holat: ${RENTAL_STATUS_LABELS[status]}`);
    }

    const price = this.formatMoney(value.price, value.currency);
    if (price) parts.push(price);

    if (typeof value.notes === 'string' && value.notes.trim()) {
      parts.push(`Izoh: ${value.notes.trim()}`);
    }

    if (typeof value.imei === 'string' && value.imei.trim()) {
      parts.push(`IMEI: ${value.imei.trim()}`);
    }

    return parts.length ? this.joinLimited(parts) : null;
  }

  private async resolveCommentCreatorId(trx: DbClient, adminId: string): Promise<string> {
    const existing = adminId
      ? await trx('admins').where({ id: adminId }).first<{ id: string }>('id')
      : null;

    if (existing?.id) return existing.id;

    const fallback = await trx('admins')
      .where({ id: DEFAULT_SYSTEM_ADMIN_ID })
      .first<{ id: string }>('id');

    if (fallback?.id) return fallback.id;

    const firstAdmin = await trx('admins').orderBy('created_at', 'asc').first<{ id: string }>('id');
    if (!firstAdmin?.id) {
      throw new Error('No admin found to attribute generated history comment');
    }

    return firstAdmin.id;
  }

  private async resolveStatusBy(
    trx: DbClient,
    history: RepairOrderChangeHistory,
  ): Promise<string | null> {
    if (history.field === 'status_id') {
      const statusId = this.asString(history.new_value);
      if (statusId && (await this.statusExists(trx, statusId))) {
        return statusId;
      }
    }

    const previousStatus = await trx<RepairOrderChangeHistory>('repair_order_change_histories')
      .where({
        repair_order_id: history.repair_order_id,
        field: 'status_id',
      })
      .andWhere('created_at', '<=', history.created_at)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .first();

    const previousStatusId = this.asString(previousStatus?.new_value ?? null);
    if (previousStatusId && (await this.statusExists(trx, previousStatusId))) {
      return previousStatusId;
    }

    const order = await trx('repair_orders')
      .where({ id: history.repair_order_id })
      .first<{ status_id: string }>('status_id');

    return order?.status_id ?? null;
  }

  private async statusExists(trx: DbClient, statusId: string): Promise<boolean> {
    const row = await trx('repair_order_statuses')
      .where({ id: statusId })
      .first<{ id: string }>('id');
    return Boolean(row?.id);
  }

  private async resolveStatusName(trx: DbClient, statusId: string | null): Promise<string | null> {
    return this.resolveLookupLabel(trx, 'repair_order_statuses', statusId);
  }

  private async resolveBranchName(trx: DbClient, branchId: string | null): Promise<string | null> {
    return this.resolveLookupLabel(trx, 'branches', branchId);
  }

  private async resolvePhoneCategoryName(
    trx: DbClient,
    categoryId: string | null,
  ): Promise<string | null> {
    return this.resolveLookupLabel(trx, 'phone_categories', categoryId);
  }

  private async resolveProblemCategoryName(
    trx: DbClient,
    categoryId: string | null,
  ): Promise<string | null> {
    return this.resolveLookupLabel(trx, 'problem_categories', categoryId);
  }

  private async resolveRepairPartName(
    trx: DbClient,
    partId: string | null,
  ): Promise<string | null> {
    if (!partId) return null;

    const cacheKey = `repair_parts:${partId}`;
    const cached = this.lookupCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const part = await trx('repair_parts')
      .where({ id: partId })
      .first<NameLookupRow>('id', 'part_name_uz', 'part_name_ru', 'part_name_en');

    const value = part?.part_name_uz ?? part?.part_name_ru ?? part?.part_name_en ?? null;
    this.lookupCache.set(cacheKey, value);
    return value;
  }

  private async resolveRejectCauseName(
    trx: DbClient,
    causeId: string | null,
  ): Promise<string | null> {
    return this.resolveLookupLabel(trx, 'repair_order_reject_causes', causeId);
  }

  private async resolveRegionTitle(trx: DbClient, regionId: string | null): Promise<string | null> {
    return this.resolveLookupLabel(trx, 'repair_order_regions', regionId);
  }

  private async resolveUserLabel(trx: DbClient, userId: string | null): Promise<string | null> {
    if (!userId) return null;

    const cacheKey = `users:${userId}`;
    const cached = this.lookupCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const user = await trx('users')
      .where({ id: userId })
      .first<NameLookupRow>('id', 'first_name', 'last_name', 'phone_number1');

    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
    const value = fullName || user?.phone_number1 || null;
    this.lookupCache.set(cacheKey, value);
    return value;
  }

  private async resolveAdminNames(trx: DbClient, adminIds: string[]): Promise<string[]> {
    const names = await Promise.all(adminIds.map((adminId) => this.resolveAdminName(trx, adminId)));

    return names.filter((name): name is string => Boolean(name));
  }

  private async resolveAdminName(trx: DbClient, adminId: string | null): Promise<string | null> {
    if (!adminId) return null;

    const cacheKey = `admins:${adminId}`;
    const cached = this.lookupCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const admin = await trx('admins')
      .where({ id: adminId })
      .first<NameLookupRow>('id', 'first_name', 'last_name');

    const value = [admin?.first_name, admin?.last_name].filter(Boolean).join(' ').trim() || null;
    this.lookupCache.set(cacheKey, value);
    return value;
  }

  private async resolveRentalPhoneDeviceLabel(
    trx: DbClient,
    deviceId: string | null,
  ): Promise<string | null> {
    if (!deviceId) return null;

    const cacheKey = `rental_phone_devices:${deviceId}`;
    const cached = this.lookupCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const device = await trx('rental_phone_devices')
      .where({ id: deviceId })
      .first<NameLookupRow>('id', 'name', 'brand', 'model', 'imei');

    const value =
      device?.name ||
      [device?.brand, device?.model].filter(Boolean).join(' ').trim() ||
      device?.imei ||
      null;

    this.lookupCache.set(cacheKey, value);
    return value;
  }

  private async resolveLookupLabel(
    trx: DbClient,
    table: string,
    id: string | null,
  ): Promise<string | null> {
    if (!id) return null;

    const cacheKey = `${table}:${id}`;
    const cached = this.lookupCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const row = await this.selectLookupRow(trx, table, id);

    const value = row?.name_uz ?? row?.name_ru ?? row?.name_en ?? row?.name ?? row?.title ?? null;
    this.lookupCache.set(cacheKey, value);
    return value;
  }

  private async selectLookupRow(
    trx: DbClient,
    table: string,
    id: string,
  ): Promise<NameLookupRow | undefined> {
    switch (table) {
      case 'repair_order_statuses':
      case 'branches':
      case 'phone_categories':
      case 'problem_categories':
        return trx(table).where({ id }).first<NameLookupRow>('id', 'name_uz', 'name_ru', 'name_en');
      case 'repair_order_reject_causes':
        return trx(table).where({ id }).first<NameLookupRow>('id', 'name');
      case 'repair_order_regions':
        return trx(table).where({ id }).first<NameLookupRow>('id', 'title');
      default:
        return trx(table)
          .where({ id })
          .first<NameLookupRow>('id', 'name_uz', 'name_ru', 'name_en', 'name', 'title');
    }
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  private safeDisplayText(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'boolean') return value ? 'Ha' : "Yo'q";
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (this.looksLikeUuid(trimmed)) return null;
      return trimmed;
    }
    return null;
  }

  private formatDateTime(value: unknown): string | null {
    if (typeof value !== 'string' && !(value instanceof Date)) return null;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      const raw = this.safeDisplayText(value);
      return raw;
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`;
  }

  private formatMoney(value: unknown, currency?: unknown): string | null {
    if (value == null || value === '') return null;

    const parsed = Number(value);
    if (Number.isNaN(parsed)) return null;

    const money = new Intl.NumberFormat('uz-UZ').format(parsed);
    const currencyLabel =
      typeof currency === 'string' && CURRENCY_LABELS[currency]
        ? CURRENCY_LABELS[currency]
        : typeof currency === 'string'
          ? currency
          : "so'm";

    return `${money} ${currencyLabel}`;
  }

  private formatMinutes(value: unknown): string | null {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) return null;
    return `${parsed} daqiqa`;
  }

  private formatQuantity(value: unknown): string | null {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) return null;
    return `${parsed} dona`;
  }

  private joinLimited(values: string[]): string {
    const filtered = values.filter(Boolean);
    if (!filtered.length) return '';
    if (filtered.length <= 2) return filtered.join(', ');
    return `${filtered.slice(0, 2).join(', ')} va yana ${filtered.length - 2} ta`;
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
