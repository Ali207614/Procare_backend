import { Knex } from 'knex';

export type HistoryDb = Knex | Knex.Transaction;

export type HistoryValueType =
  | 'null'
  | 'string'
  | 'text'
  | 'uuid'
  | 'integer'
  | 'decimal'
  | 'money'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'enum'
  | 'phone'
  | 'email'
  | 'url'
  | 'file'
  | 'reference';

export type HistoryActionKind =
  | 'create'
  | 'update'
  | 'delete'
  | 'link'
  | 'unlink'
  | 'move'
  | 'login'
  | 'logout'
  | 'sync'
  | 'job'
  | 'webhook'
  | 'read_sensitive'
  | 'other';

export type HistorySourceType =
  | 'admin_api'
  | 'user_api'
  | 'system_job'
  | 'cron'
  | 'webhook'
  | 'seed'
  | 'script'
  | 'migration'
  | 'integration'
  | 'unknown';

export type HistoryActorRole =
  | 'initiator'
  | 'executor'
  | 'approver'
  | 'system'
  | 'external_source'
  | 'impersonated_by';

export type HistoryActorType =
  | 'admin'
  | 'user'
  | 'system'
  | 'cron'
  | 'webhook'
  | 'integration'
  | 'script'
  | 'migration'
  | 'unknown';

export type HistoryEntityRole =
  | 'primary_target'
  | 'created'
  | 'updated'
  | 'deleted'
  | 'linked'
  | 'unlinked'
  | 'affected'
  | 'victim'
  | 'read_dependency'
  | 'permission_dependency'
  | 'workflow_dependency'
  | 'external_reference'
  | 'notification_target'
  | 'derived_output';

export type HistoryOperation = 'insert' | 'update' | 'delete' | 'link' | 'unlink' | 'touch';

export type HistoryEdgeType =
  | 'initiated'
  | 'executed'
  | 'changed'
  | 'created'
  | 'deleted'
  | 'linked'
  | 'unlinked'
  | 'replaced'
  | 'derived_from'
  | 'allowed_by'
  | 'blocked_by'
  | 'read_from'
  | 'affected'
  | 'notified'
  | 'current_value_of';

export interface HistoryScalarValue {
  valueType: HistoryValueType;
  valueText?: string | number | boolean | Date | null;
  valueNormalized?: string | null;
  refTable?: string | null;
  refPk?: string | null;
  refLabel?: string | null;
  isSensitive?: boolean;
}

export interface HistoryEventInput extends HistoryScalarValue {
  inputKey: string;
}

export interface HistoryEventActor {
  actorRole: HistoryActorRole;
  actorType: HistoryActorType;
  actorTable?: string | null;
  actorPk?: string | null;
  actorLabel?: string | null;
  authSubject?: string | null;
  permissionName?: string | null;
}

export interface HistoryEventEntity {
  entityTable: string;
  entityPk: string;
  entityLabel?: string | null;
  entityRole: HistoryEntityRole;
  rootEntityTable?: string | null;
  rootEntityPk?: string | null;
  branchId?: string | null;
  beforeExists?: boolean | null;
  afterExists?: boolean | null;
}

export interface HistoryFieldChange {
  entityTable: string;
  entityPk: string;
  fieldPath: string;
  operation: HistoryOperation;
  valueType: HistoryValueType;
  eventEntityKey?: string;
  oldValue?: HistoryScalarValue;
  newValue?: HistoryScalarValue;
  isSensitive?: boolean;
  changedAt?: Date;
  trackCurrentValue?: boolean;
}

export interface HistoryEventWrite {
  actionKey: string;
  actionKind: HistoryActionKind;
  sourceType: HistorySourceType;
  sourceName?: string | null;
  occurredAt?: Date;
  requestId?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  httpMethod?: string | null;
  httpPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  rootEntityTable?: string | null;
  rootEntityPk?: string | null;
  branchId?: string | null;
  isSuccess?: boolean;
  failureCode?: string | null;
  failureMessage?: string | null;
  actors?: HistoryEventActor[];
  entities?: (HistoryEventEntity & { key?: string })[];
  inputs?: HistoryEventInput[];
  changes?: HistoryFieldChange[];
}

export interface HistoryTrackedFieldRow {
  entity_table: string;
  field_path: string;
  value_type: HistoryValueType;
  is_active: boolean;
  is_sensitive: boolean;
  track_current_value: boolean;
  capture_old_value: boolean;
  capture_new_value: boolean;
  ref_table: string | null;
  normalizer_key: string | null;
  redaction_strategy: 'none' | 'mask' | 'hash_only' | 'omit';
}

export interface HistoryEventRow {
  id: string;
  occurred_at: Date;
  action_key: string;
  action_kind: HistoryActionKind;
  source_type: HistorySourceType;
  source_name: string | null;
  request_id: string | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  http_method: string | null;
  http_path: string | null;
  ip_address: string | null;
  user_agent: string | null;
  root_entity_table: string | null;
  root_entity_pk: string | null;
  branch_id: string | null;
  is_success: boolean;
  failure_code: string | null;
  failure_message: string | null;
  previous_event_hash: string | null;
  event_hash: string | null;
  created_at: Date;
}

export interface HistoryNodeRow {
  id: string;
  node_type: 'event' | 'actor' | 'entity' | 'field_change' | 'current_value' | 'event_input';
  label: string | null;
  event_id: string | null;
  actor_id: string | null;
  event_entity_id: string | null;
  field_change_id: string | null;
  current_value_id: string | null;
  event_input_id: string | null;
  created_at: Date;
}

export interface HistoryEdgeRow {
  id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: HistoryEdgeType;
  event_id: string | null;
  confidence: string | number;
  note: string | null;
  created_at: Date;
}

export interface HistoryCurrentValueRow {
  id: string;
  entity_table: string;
  entity_pk: string;
  field_path: string;
  value_type: HistoryValueType;
  value_text: string | null;
  value_normalized: string | null;
  value_hash: string | null;
  ref_table: string | null;
  ref_pk: string | null;
  ref_label: string | null;
  last_change_id: string | null;
  current_since: Date | null;
  updated_at: Date;
}

export interface HistoryFieldChangeRow {
  id: string;
  event_id: string;
  event_entity_id: string | null;
  entity_table: string;
  entity_pk: string;
  field_path: string;
  operation: HistoryOperation;
  value_type: HistoryValueType;
  old_value_text: string | null;
  old_value_normalized: string | null;
  old_value_hash: string | null;
  old_ref_table: string | null;
  old_ref_pk: string | null;
  old_ref_label: string | null;
  new_value_text: string | null;
  new_value_normalized: string | null;
  new_value_hash: string | null;
  new_ref_table: string | null;
  new_ref_pk: string | null;
  new_ref_label: string | null;
  is_sensitive: boolean;
  changed_at: Date;
}
