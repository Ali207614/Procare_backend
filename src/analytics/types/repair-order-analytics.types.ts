export type RepairOrderAnalyticsGroupBy = 'operator' | 'source' | 'reject_cause';

export type RepairOrderAnalyticsDateField = 'created_at' | 'updated_at';

export type RepairOrderAnalyticsUpdatedScope = 'status_transitions' | 'all_updates';

export interface RepairOrderAnalyticsStatus {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  color: string | null;
  bg_color: string | null;
  sort: number;
  is_active: boolean;
  branch_id: string;
}

export interface RepairOrderAnalyticsStatusMetric {
  status_id: string;
  count: number;
  percent_of_group: number;
  percent_of_total: number;
}

export interface RepairOrderAnalyticsSummaryStatusMetric {
  status_id: string;
  count: number;
  percent_of_total: number;
}

export interface RepairOrderAnalyticsRow {
  index: number;
  group: {
    id: string | null;
    key: string;
    label: string;
    type: RepairOrderAnalyticsGroupBy;
  };
  leads: {
    count: number;
    percent_of_total: number;
  };
  status_metrics: Record<string, RepairOrderAnalyticsStatusMetric>;
}

export interface RepairOrderAnalyticsResponse {
  meta: {
    group_by: RepairOrderAnalyticsGroupBy;
    generated_at: string;
    date: {
      start_time: string;
      end_time: string;
      date_field: RepairOrderAnalyticsDateField;
      updated_scope?: RepairOrderAnalyticsUpdatedScope;
    };
    filters: {
      branch_ids: string[];
      status_column_ids?: string[];
    };
  };
  statuses: RepairOrderAnalyticsStatus[];
  summary: {
    label: 'Jami ulush';
    leads: {
      count: number;
      percent_of_total: number;
    };
    status_metrics: Record<string, RepairOrderAnalyticsSummaryStatusMetric>;
  };
  rows: RepairOrderAnalyticsRow[];
}

export interface RepairOrderAnalyticsDateRange {
  start: Date;
  endExclusive: Date;
}

export interface RepairOrderAnalyticsScope {
  branchIds: string[];
  canViewAllBranches: boolean;
}

export interface RepairOrderAnalyticsGroupedCountRow {
  group_id: string | null;
  group_key: string;
  group_label: string;
  metric_status_id: string;
  count: string | number;
}

export interface RepairOrderAnalyticsGroupDefinition {
  id: string | null;
  key: string;
  label: string;
  sort: number;
}
