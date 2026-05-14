import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { REPAIR_ORDER_SOURCES } from 'src/common/types/repair-order.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RoleType } from 'src/common/types/role-type.enum';
import { PermissionsService } from 'src/permissions/permissions.service';
import { RepairOrderAnalyticsQueryDto } from './dto/repair-order-analytics-query.dto';
import {
  RepairOrderAnalyticsDateRange,
  RepairOrderAnalyticsGroupDefinition,
  RepairOrderAnalyticsGroupedCountRow,
  RepairOrderAnalyticsGroupBy,
  RepairOrderAnalyticsResponse,
  RepairOrderAnalyticsScope,
  RepairOrderAnalyticsStatus,
} from './types/repair-order-analytics.types';

@Injectable()
export class RepairOrderAnalyticsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionsService: PermissionsService,
  ) {}

  async getByOperators(
    admin: AdminPayload,
    query: RepairOrderAnalyticsQueryDto,
  ): Promise<RepairOrderAnalyticsResponse> {
    return this.buildAnalyticsResponse(admin, query, 'operator');
  }

  async getBySources(
    admin: AdminPayload,
    query: RepairOrderAnalyticsQueryDto,
  ): Promise<RepairOrderAnalyticsResponse> {
    return this.buildAnalyticsResponse(admin, query, 'source');
  }

  async getByRejectCauses(
    admin: AdminPayload,
    query: RepairOrderAnalyticsQueryDto,
  ): Promise<RepairOrderAnalyticsResponse> {
    return this.buildInvalidStatusTransitionResponse(admin, query);
  }

  private async buildAnalyticsResponse(
    admin: AdminPayload,
    query: RepairOrderAnalyticsQueryDto,
    groupBy: RepairOrderAnalyticsGroupBy,
  ): Promise<RepairOrderAnalyticsResponse> {
    const dateRange = this.resolveDateRange(query);
    const scope = await this.resolveBranchScope(admin, query.branch_ids);
    const statuses = await this.resolveStatusColumns(scope.branchIds, query.status_column_ids);
    const groups = await this.resolveGroupDefinitions(groupBy, scope, query);
    const counts = await this.fetchGroupedCounts(groupBy, query, scope.branchIds, dateRange);

    return this.mapCountsToResponse({
      groupBy,
      query,
      scope,
      dateRange,
      statuses,
      groups,
      counts,
    });
  }

  private async buildInvalidStatusTransitionResponse(
    admin: AdminPayload,
    query: RepairOrderAnalyticsQueryDto,
  ): Promise<RepairOrderAnalyticsResponse> {
    const transitionQuery = {
      ...query,
      date_field: 'updated_at' as const,
      updated_scope: 'status_transitions' as const,
    };
    const dateRange = this.resolveDateRange(query);
    const scope = await this.resolveBranchScope(admin, transitionQuery.branch_ids);
    const statuses = await this.resolveStatusColumns(
      scope.branchIds,
      transitionQuery.status_column_ids,
    );
    const groups = await this.resolveGroupDefinitions('reject_cause', scope, transitionQuery);
    const counts = await this.fetchInvalidStatusTransitionCounts(
      transitionQuery,
      scope.branchIds,
      dateRange,
    );

    return this.mapCountsToResponse({
      groupBy: 'reject_cause',
      query: transitionQuery,
      scope,
      dateRange,
      statuses,
      groups,
      counts,
    });
  }

  private resolveDateRange(query: RepairOrderAnalyticsQueryDto): RepairOrderAnalyticsDateRange {
    const start = this.parseRangeBoundary(query.start_time, 'start_time', false);
    const endExclusive = this.parseRangeBoundary(query.end_time, 'end_time', true);

    if (start >= endExclusive) {
      throw new BadRequestException({
        message: 'start_time must be before end_time',
        location: 'date_range',
      });
    }

    return { start, endExclusive };
  }

  private parseRangeBoundary(value: string, location: string, isEnd: boolean): Date {
    if (!value?.trim()) {
      throw new BadRequestException({
        message: `${location} is required`,
        location,
      });
    }

    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      if (isEnd) {
        date.setDate(date.getDate() + 1);
      }
      return date;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({
        message: `${location} must be a valid date or ISO timestamp`,
        location,
      });
    }

    return parsed;
  }

  private async resolveBranchScope(
    admin: AdminPayload,
    requestedBranchIds?: string[],
  ): Promise<RepairOrderAnalyticsScope> {
    const permissions = await this.permissionsService.getPermissions(admin.id);
    const canViewAllBranches =
      admin.roles.some((role) => role.type === RoleType.SUPER_ADMIN) ||
      permissions.includes('analytics.repair_orders.view_all');

    const requestedIds = this.normalizeIds(requestedBranchIds);

    if (canViewAllBranches) {
      const branchIds = requestedIds.length
        ? await this.validateOpenBranchIds(requestedIds)
        : await this.fetchAllOpenBranchIds();

      return { branchIds, canViewAllBranches };
    }

    const viewableBranchIds = await this.fetchViewableBranchIds(admin);
    if (!viewableBranchIds.length) {
      throw new ForbiddenException({
        message: 'You do not have access to analytics for any branch.',
        location: 'branch_ids',
      });
    }

    if (!requestedIds.length) {
      return { branchIds: viewableBranchIds, canViewAllBranches };
    }

    const allowed = new Set(viewableBranchIds);
    const denied = requestedIds.filter((branchId) => !allowed.has(branchId));
    if (denied.length) {
      throw new ForbiddenException({
        message: 'You do not have access to one or more requested branches.',
        location: 'branch_ids',
        denied_branch_ids: denied,
      });
    }

    await this.validateOpenBranchIds(requestedIds);
    return { branchIds: requestedIds, canViewAllBranches };
  }

  private normalizeIds(ids?: string[]): string[] {
    return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
  }

  private async fetchAllOpenBranchIds(): Promise<string[]> {
    const rows = await this.knex('branches')
      .where({ status: 'Open', is_active: true })
      .orderBy('sort', 'asc')
      .pluck<string>('id');

    return rows as string[];
  }

  private async validateOpenBranchIds(branchIds: string[]): Promise<string[]> {
    const rows = await this.knex('branches')
      .whereIn('id', branchIds)
      .andWhere({ status: 'Open', is_active: true })
      .pluck<string>('id');

    const found = new Set(rows);
    const missing = branchIds.filter((branchId) => !found.has(branchId));
    if (missing.length) {
      throw new BadRequestException({
        message: 'One or more branch IDs are invalid or inactive.',
        location: 'branch_ids',
        missing_branch_ids: missing,
      });
    }

    return branchIds;
  }

  private async fetchViewableBranchIds(admin: AdminPayload): Promise<string[]> {
    const roleIds = admin.roles.map((role) => role.id).filter(Boolean);
    if (!roleIds.length) return [];

    const rows = await this.knex('branches as b')
      .join('admin_branches as ab', 'ab.branch_id', 'b.id')
      .join('repair_order_status_permissions as rosp', 'rosp.branch_id', 'b.id')
      .where('ab.admin_id', admin.id)
      .whereIn('rosp.role_id', roleIds)
      .andWhere('rosp.can_view', true)
      .andWhere({ 'b.status': 'Open', 'b.is_active': true })
      .distinct('b.id')
      .orderBy('b.sort', 'asc');

    return rows.map((row: { id: string }) => row.id);
  }

  private async resolveStatusColumns(
    branchIds: string[],
    statusColumnIds?: string[],
  ): Promise<RepairOrderAnalyticsStatus[]> {
    const requestedStatusIds = this.normalizeIds(statusColumnIds);

    const query = this.knex('repair_order_statuses')
      .select(
        'id',
        'name_uz',
        'name_ru',
        'name_en',
        'color',
        'bg_color',
        'sort',
        'is_active',
        'branch_id',
      )
      .whereIn('branch_id', branchIds)
      .andWhere('status', 'Open')
      .orderBy('sort', 'asc')
      .orderBy('name_uz', 'asc');

    if (requestedStatusIds.length) {
      void query.whereIn('id', requestedStatusIds);
    } else {
      void query.andWhere('is_active', true);
    }

    const statuses = (await query) as RepairOrderAnalyticsStatus[];

    if (requestedStatusIds.length) {
      const found = new Set(statuses.map((status) => status.id));
      const missing = requestedStatusIds.filter((statusId) => !found.has(statusId));
      if (missing.length) {
        throw new BadRequestException({
          message: 'One or more status_column_ids are invalid for the selected branch scope.',
          location: 'status_column_ids',
          missing_status_ids: missing,
        });
      }
    }

    return statuses;
  }

  private async fetchGroupedCounts(
    groupBy: RepairOrderAnalyticsGroupBy,
    query: RepairOrderAnalyticsQueryDto,
    branchIds: string[],
    dateRange: RepairOrderAnalyticsDateRange,
  ): Promise<RepairOrderAnalyticsGroupedCountRow[]> {
    if (!branchIds.length) return [];

    if (query.date_field === 'updated_at' && query.updated_scope === 'status_transitions') {
      return this.fetchStatusTransitionCounts(groupBy, query, branchIds, dateRange);
    }

    return this.fetchSnapshotCounts(groupBy, query, branchIds, dateRange);
  }

  private async fetchSnapshotCounts(
    groupBy: RepairOrderAnalyticsGroupBy,
    query: RepairOrderAnalyticsQueryDto,
    branchIds: string[],
    dateRange: RepairOrderAnalyticsDateRange,
  ): Promise<RepairOrderAnalyticsGroupedCountRow[]> {
    const dateColumn = query.date_field === 'updated_at' ? 'ro.updated_at' : 'ro.created_at';
    const groupSql = this.groupSql(groupBy);
    const rejectCauseFilter =
      groupBy === 'reject_cause' && !query.include_empty_reject_cause
        ? 'AND ro.reject_cause_id IS NOT NULL'
        : '';

    const result = await this.knex.raw(
      `
      WITH base_orders AS (
        SELECT
          ro.id,
          ro.status_id AS metric_status_id,
          ro.source,
          ro.reject_cause_id
        FROM repair_orders ro
        WHERE ro.status <> 'Deleted'
          AND ro.branch_id = ANY(?::uuid[])
          AND ${dateColumn} >= ?
          AND ${dateColumn} < ?
          ${rejectCauseFilter}
      ),
      operator_assignment AS (
        SELECT DISTINCT ON (raa.repair_order_id)
          raa.repair_order_id,
          a.id AS operator_id,
          NULLIF(CONCAT_WS(' ', a.first_name, a.last_name), '') AS operator_name
        FROM repair_order_assign_admins raa
        JOIN admins a ON a.id = raa.admin_id
        JOIN admin_roles ar ON ar.admin_id = a.id
        JOIN roles r ON r.id = ar.role_id
        WHERE r.type = 'Operator'
          AND r.status = 'Open'
          AND r.is_active = true
          AND a.status = 'Open'
          AND a.is_active = true
        ORDER BY raa.repair_order_id, raa.created_at DESC, raa.id DESC
      )
      SELECT
        ${groupSql.id} AS group_id,
        ${groupSql.key} AS group_key,
        ${groupSql.label} AS group_label,
        bo.metric_status_id,
        COUNT(*)::int AS count
      FROM base_orders bo
      ${groupSql.join}
      WHERE ${groupSql.where}
      GROUP BY 1, 2, 3, 4
      ORDER BY group_label ASC
      `,
      [branchIds, dateRange.start, dateRange.endExclusive],
    );

    return result.rows as RepairOrderAnalyticsGroupedCountRow[];
  }

  private async fetchStatusTransitionCounts(
    groupBy: RepairOrderAnalyticsGroupBy,
    query: RepairOrderAnalyticsQueryDto,
    branchIds: string[],
    dateRange: RepairOrderAnalyticsDateRange,
  ): Promise<RepairOrderAnalyticsGroupedCountRow[]> {
    const groupSql = this.groupSql(groupBy);
    const rejectCauseFilter =
      groupBy === 'reject_cause' && !query.include_empty_reject_cause
        ? 'AND ro.reject_cause_id IS NOT NULL'
        : '';

    const result = await this.knex.raw(
      `
      WITH latest_status_transition AS (
        SELECT
          ranked.repair_order_id,
          ranked.metric_status_id
        FROM (
          SELECT
            h.repair_order_id,
            h.new_value #>> '{}' AS metric_status_id,
            ROW_NUMBER() OVER (
              PARTITION BY h.repair_order_id
              ORDER BY h.created_at DESC, h.id DESC
            ) AS rn
          FROM repair_order_change_histories h
          WHERE h.field = 'status_id'
            AND h.created_at >= ?
            AND h.created_at < ?
        ) ranked
        WHERE ranked.rn = 1
      ),
      base_orders AS (
        SELECT
          ro.id,
          latest_status_transition.metric_status_id::uuid AS metric_status_id,
          ro.source,
          ro.reject_cause_id
        FROM latest_status_transition
        JOIN repair_orders ro ON ro.id = latest_status_transition.repair_order_id
        WHERE ro.status <> 'Deleted'
          AND ro.branch_id = ANY(?::uuid[])
          AND latest_status_transition.metric_status_id IS NOT NULL
          ${rejectCauseFilter}
      ),
      operator_assignment AS (
        SELECT DISTINCT ON (raa.repair_order_id)
          raa.repair_order_id,
          a.id AS operator_id,
          NULLIF(CONCAT_WS(' ', a.first_name, a.last_name), '') AS operator_name
        FROM repair_order_assign_admins raa
        JOIN admins a ON a.id = raa.admin_id
        JOIN admin_roles ar ON ar.admin_id = a.id
        JOIN roles r ON r.id = ar.role_id
        WHERE r.type = 'Operator'
          AND r.status = 'Open'
          AND r.is_active = true
          AND a.status = 'Open'
          AND a.is_active = true
        ORDER BY raa.repair_order_id, raa.created_at DESC, raa.id DESC
      )
      SELECT
        ${groupSql.id} AS group_id,
        ${groupSql.key} AS group_key,
        ${groupSql.label} AS group_label,
        bo.metric_status_id,
        COUNT(*)::int AS count
      FROM base_orders bo
      ${groupSql.join}
      WHERE ${groupSql.where}
      GROUP BY 1, 2, 3, 4
      ORDER BY group_label ASC
      `,
      [dateRange.start, dateRange.endExclusive, branchIds],
    );

    return result.rows as RepairOrderAnalyticsGroupedCountRow[];
  }

  private async fetchInvalidStatusTransitionCounts(
    query: RepairOrderAnalyticsQueryDto,
    branchIds: string[],
    dateRange: RepairOrderAnalyticsDateRange,
  ): Promise<RepairOrderAnalyticsGroupedCountRow[]> {
    if (!branchIds.length) return [];

    const rejectCauseFilter = !query.include_empty_reject_cause
      ? 'AND ro.reject_cause_id IS NOT NULL'
      : '';

    const result = await this.knex.raw(
      `
      WITH latest_invalid_status_transition AS (
        SELECT
          ranked.repair_order_id,
          ranked.reject_cause_id,
          ranked.previous_status_id AS metric_status_id
        FROM (
          SELECT
            h.repair_order_id,
            ro.reject_cause_id,
            (h.old_value #>> '{}')::uuid AS previous_status_id,
            ROW_NUMBER() OVER (
              PARTITION BY h.repair_order_id
              ORDER BY h.created_at DESC, h.id DESC
            ) AS rn
          FROM repair_order_change_histories h
          JOIN repair_orders ro ON ro.id = h.repair_order_id
          JOIN repair_order_statuses invalid_status
            ON invalid_status.id = (h.new_value #>> '{}')::uuid
           AND invalid_status.type = 'Invalid'
           AND invalid_status.status = 'Open'
          WHERE h.field = 'status_id'
            AND h.created_at >= ?
            AND h.created_at < ?
            AND ro.status <> 'Deleted'
            AND ro.branch_id = ANY(?::uuid[])
            AND h.old_value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND h.new_value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            ${rejectCauseFilter}
        ) ranked
        WHERE ranked.rn = 1
      )
      SELECT
        reject_cause.id AS group_id,
        COALESCE(reject_cause.id::text, 'empty') AS group_key,
        COALESCE(reject_cause.name, 'Sabab belgilanmagan') AS group_label,
        latest_invalid_status_transition.metric_status_id,
        COUNT(*)::int AS count
      FROM latest_invalid_status_transition
      LEFT JOIN repair_order_reject_causes reject_cause
        ON reject_cause.id = latest_invalid_status_transition.reject_cause_id
      GROUP BY 1, 2, 3, 4
      ORDER BY group_label ASC
      `,
      [dateRange.start, dateRange.endExclusive, branchIds],
    );

    return result.rows as RepairOrderAnalyticsGroupedCountRow[];
  }

  private async resolveGroupDefinitions(
    groupBy: RepairOrderAnalyticsGroupBy,
    scope: RepairOrderAnalyticsScope,
    query: RepairOrderAnalyticsQueryDto,
  ): Promise<RepairOrderAnalyticsGroupDefinition[]> {
    if (groupBy === 'source') {
      return [
        ...REPAIR_ORDER_SOURCES.map((source, index) => ({
          id: null,
          key: source,
          label: source,
          sort: index + 1,
        })),
        {
          id: null,
          key: 'unknown',
          label: 'Manba belgilanmagan',
          sort: REPAIR_ORDER_SOURCES.length + 1,
        },
      ];
    }

    if (!scope.branchIds.length) return [];

    if (groupBy === 'operator') {
      const hasExplicitBranchFilter = this.normalizeIds(query.branch_ids).length > 0;
      const shouldFilterByBranch = !scope.canViewAllBranches || hasExplicitBranchFilter;
      const rows = await this.fetchOperatorGroupDefinitions(scope.branchIds, shouldFilterByBranch);

      if (rows.length || shouldFilterByBranch) {
        return rows;
      }

      return this.fetchOperatorGroupDefinitions(scope.branchIds, false);
    }

    const rows = await this.knex('repair_order_reject_causes')
      .select('id', 'name', 'sort')
      .where({ status: 'Open', is_active: true })
      .orderBy('sort', 'asc')
      .orderBy('name', 'asc');

    const groups: RepairOrderAnalyticsGroupDefinition[] = rows.map(
      (row: { id: string; name: string; sort: number }) => ({
        id: row.id,
        key: row.id,
        label: row.name,
        sort: row.sort,
      }),
    );

    if (query.include_empty_reject_cause) {
      groups.push({
        id: null,
        key: 'empty',
        label: 'Sabab belgilanmagan',
        sort: Number.MAX_SAFE_INTEGER,
      });
    }

    return groups;
  }

  private async fetchOperatorGroupDefinitions(
    branchIds: string[],
    filterByBranch: boolean,
  ): Promise<RepairOrderAnalyticsGroupDefinition[]> {
    const query = this.knex('admins as a')
      .join('admin_roles as ar', 'ar.admin_id', 'a.id')
      .join('roles as r', 'r.id', 'ar.role_id')
      .andWhere('r.type', RoleType.OPERATOR)
      .andWhere('r.status', 'Open')
      .andWhere('r.is_active', true)
      .andWhere('a.status', 'Open')
      .andWhere('a.is_active', true)
      .select(
        'a.id',
        this.knex.raw("NULLIF(CONCAT_WS(' ', a.first_name, a.last_name), '') AS label"),
      )
      .distinct('a.id')
      .orderBy('label', 'asc')
      .orderBy('a.id', 'asc');

    if (filterByBranch) {
      void query.whereExists((builder) => {
        void builder
          .select(this.knex.raw('1'))
          .from('admin_branches as ab')
          .whereRaw('ab.admin_id = a.id')
          .whereIn('ab.branch_id', branchIds);
      });
    }

    const rows = await query;

    return rows.map((row: { id: string; label: string | null }, index) => ({
      id: row.id,
      key: row.id,
      label: row.label ?? 'Nomsiz operator',
      sort: index + 1,
    }));
  }

  private groupSql(groupBy: RepairOrderAnalyticsGroupBy): {
    id: string;
    key: string;
    label: string;
    join: string;
    where: string;
  } {
    if (groupBy === 'operator') {
      return {
        id: 'oa.operator_id',
        key: 'oa.operator_id::text',
        label: "COALESCE(oa.operator_name, 'Nomsiz operator')",
        join: 'JOIN operator_assignment oa ON oa.repair_order_id = bo.id',
        where: 'true',
      };
    }

    if (groupBy === 'source') {
      return {
        id: 'NULL::uuid',
        key: "COALESCE(bo.source, 'unknown')",
        label: "COALESCE(bo.source, 'Manba belgilanmagan')",
        join: '',
        where: 'true',
      };
    }

    return {
      id: 'rrc.id',
      key: "COALESCE(rrc.id::text, 'empty')",
      label: "COALESCE(rrc.name, 'Sabab belgilanmagan')",
      join: 'LEFT JOIN repair_order_reject_causes rrc ON rrc.id = bo.reject_cause_id',
      where: 'true',
    };
  }

  private mapCountsToResponse(params: {
    groupBy: RepairOrderAnalyticsGroupBy;
    query: RepairOrderAnalyticsQueryDto;
    scope: RepairOrderAnalyticsScope;
    dateRange: RepairOrderAnalyticsDateRange;
    statuses: RepairOrderAnalyticsStatus[];
    groups: RepairOrderAnalyticsGroupDefinition[];
    counts: RepairOrderAnalyticsGroupedCountRow[];
  }): RepairOrderAnalyticsResponse {
    const statusIds = params.statuses.map((status) => status.id);
    const visibleStatusIds = new Set(statusIds);
    const groups = new Map<
      string,
      {
        id: string | null;
        key: string;
        label: string;
        sort: number;
        total: number;
        statusCounts: Map<string, number>;
      }
    >();
    const summaryCounts = new Map<string, number>();
    let totalLeads = 0;

    for (const group of params.groups) {
      groups.set(group.key, {
        id: group.id,
        key: group.key,
        label: group.label,
        sort: group.sort,
        total: 0,
        statusCounts: new Map<string, number>(),
      });
    }

    for (const row of params.counts) {
      const key = row.group_key;
      const count = Number(row.count) || 0;

      if (!groups.has(key)) {
        groups.set(key, {
          id: row.group_id,
          key,
          label: row.group_label,
          sort: Number.MAX_SAFE_INTEGER,
          total: 0,
          statusCounts: new Map<string, number>(),
        });
      }

      const group = groups.get(key);
      if (!group) continue;

      group.total += count;
      totalLeads += count;

      if (visibleStatusIds.has(row.metric_status_id)) {
        group.statusCounts.set(
          row.metric_status_id,
          (group.statusCounts.get(row.metric_status_id) ?? 0) + count,
        );
        summaryCounts.set(
          row.metric_status_id,
          (summaryCounts.get(row.metric_status_id) ?? 0) + count,
        );
      }
    }

    const summaryStatusMetrics = Object.fromEntries(
      statusIds.map((statusId) => {
        const count = summaryCounts.get(statusId) ?? 0;
        return [
          statusId,
          {
            status_id: statusId,
            count,
            percent_of_total: this.percent(count, totalLeads),
          },
        ];
      }),
    );

    const rows = [...groups.values()]
      .sort((a, b) => b.total - a.total || a.sort - b.sort || a.label.localeCompare(b.label))
      .map((group, index) => {
        const statusMetrics = Object.fromEntries(
          statusIds.map((statusId) => {
            const count = group.statusCounts.get(statusId) ?? 0;
            return [
              statusId,
              {
                status_id: statusId,
                count,
                percent_of_group: this.percent(count, group.total),
                percent_of_total: this.percent(count, totalLeads),
              },
            ];
          }),
        );

        return {
          index: index + 1,
          group: {
            id: group.id,
            key: group.key,
            label: group.label,
            type: params.groupBy,
          },
          leads: {
            count: group.total,
            percent_of_total: this.percent(group.total, totalLeads),
          },
          status_metrics: statusMetrics,
        };
      });

    return {
      meta: {
        group_by: params.groupBy,
        generated_at: new Date().toISOString(),
        date: {
          start_time: params.dateRange.start.toISOString(),
          end_time: params.dateRange.endExclusive.toISOString(),
          date_field: params.query.date_field,
          updated_scope:
            params.query.date_field === 'updated_at' ? params.query.updated_scope : undefined,
        },
        filters: {
          branch_ids: params.scope.branchIds,
          status_column_ids: params.query.status_column_ids,
        },
      },
      statuses: params.statuses,
      summary: {
        label: 'Jami ulush',
        leads: {
          count: totalLeads,
          percent_of_total: totalLeads > 0 ? 100 : 0,
        },
        status_metrics: summaryStatusMetrics,
      },
      rows,
    };
  }

  private percent(count: number, total: number): number {
    if (!total) return 0;
    return Math.round((count / total) * 10000) / 100;
  }
}
