import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { isIP } from 'net';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { getRequestAuditContext } from 'src/common/utils/request-audit-context.util';
import {
  HistoryCurrentValueRow,
  HistoryDb,
  HistoryEdgeRow,
  HistoryEdgeType,
  HistoryEventRow,
  HistoryEventWrite,
  HistoryFieldChange,
  HistoryFieldChangeRow,
  HistoryNodeRow,
  HistoryOperation,
  HistoryScalarValue,
  HistoryTrackedFieldRow,
  HistoryValueType,
} from './types/history.types';

interface PreparedScalarValue {
  value_text: string | null;
  value_normalized: string | null;
  value_hash: string | null;
  ref_table: string | null;
  ref_pk: string | null;
  ref_label: string | null;
}

interface SearchCurrentValuesParams {
  value: string;
  value_type?: HistoryValueType;
  entity_table?: string;
  field_path?: string;
  limit?: number;
  offset?: number;
}

interface EntityTimelineParams {
  entity_table: string;
  entity_pk: string;
  limit?: number;
  offset?: number;
}

interface HistoryActorContext {
  actorRole?:
    | 'initiator'
    | 'executor'
    | 'approver'
    | 'system'
    | 'external_source'
    | 'impersonated_by';
  actorType?:
    | 'admin'
    | 'user'
    | 'system'
    | 'cron'
    | 'webhook'
    | 'integration'
    | 'script'
    | 'migration'
    | 'unknown';
  actorTable?: string | null;
  actorPk?: string | null;
  actorLabel?: string | null;
  permissionName?: string | null;
}

interface EntityHistoryBaseParams {
  db?: HistoryDb;
  entityTable: string;
  entityPk: string;
  entityLabel?: string | null;
  rootEntityTable?: string | null;
  rootEntityPk?: string | null;
  branchId?: string | null;
  actor?: HistoryActorContext | null;
  sourceType?: HistoryEventWrite['sourceType'];
  sourceName?: string | null;
  actionKey?: string;
}

interface EntityCreateHistoryParams extends EntityHistoryBaseParams {
  values: Record<string, unknown>;
  fields?: string[];
}

interface EntityUpdateHistoryParams extends EntityHistoryBaseParams {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields?: string[];
}

interface EntityDeleteHistoryParams extends EntityHistoryBaseParams {
  before: Record<string, unknown>;
  fields?: string[];
}

interface RelationHistoryParams {
  db?: HistoryDb;
  actionKey?: string;
  actionKind: 'link' | 'unlink';
  sourceType?: HistoryEventWrite['sourceType'];
  sourceName?: string | null;
  rootEntityTable?: string | null;
  rootEntityPk?: string | null;
  branchId?: string | null;
  actor?: HistoryActorContext | null;
  from: {
    entityTable: string;
    entityPk: string;
    entityLabel?: string | null;
    entityRole?: 'primary_target' | 'affected' | 'linked' | 'unlinked';
  };
  to: {
    entityTable: string;
    entityPk: string;
    entityLabel?: string | null;
    entityRole?: 'affected' | 'linked' | 'unlinked' | 'permission_dependency';
  };
  fieldPath: string;
}

@Injectable()
export class HistoryService {
  private readonly fallbackSearchTypes: HistoryValueType[] = [
    'string',
    'text',
    'email',
    'phone',
    'uuid',
    'integer',
    'decimal',
    'money',
    'boolean',
    'date',
    'timestamp',
    'enum',
    'url',
    'reference',
  ];
  private readonly partialSearchTypes: HistoryValueType[] = ['string'];

  constructor(@InjectKnex() private readonly knex: Knex) {}

  async recordEntityCreated(params: EntityCreateHistoryParams): Promise<HistoryEventRow | null> {
    const changes = this.buildEntityChanges({
      entityTable: params.entityTable,
      entityPk: params.entityPk,
      before: {},
      after: params.values,
      fields: params.fields,
      operation: 'insert',
      eventEntityKey: 'entity',
    });

    return this.createEvent(
      {
        actionKey: params.actionKey ?? `${params.entityTable}.create`,
        actionKind: 'create',
        sourceType: params.sourceType ?? 'admin_api',
        sourceName: params.sourceName ?? 'global_history',
        rootEntityTable: params.rootEntityTable ?? params.entityTable,
        rootEntityPk: params.rootEntityPk ?? params.entityPk,
        branchId: params.branchId ?? null,
        actors: this.actorList(params.actor),
        entities: [
          {
            key: 'entity',
            entityTable: params.entityTable,
            entityPk: params.entityPk,
            entityLabel: params.entityLabel ?? null,
            entityRole: 'created',
            rootEntityTable: params.rootEntityTable ?? params.entityTable,
            rootEntityPk: params.rootEntityPk ?? params.entityPk,
            branchId: params.branchId ?? null,
            beforeExists: false,
            afterExists: true,
          },
        ],
        changes,
      },
      params.db ?? this.knex,
    );
  }

  async recordEntityUpdated(params: EntityUpdateHistoryParams): Promise<HistoryEventRow | null> {
    const changes = this.buildEntityChanges({
      entityTable: params.entityTable,
      entityPk: params.entityPk,
      before: params.before,
      after: params.after,
      fields: params.fields,
      operation: 'update',
      eventEntityKey: 'entity',
    });

    if (changes.length === 0) {
      return null;
    }

    return this.createEvent(
      {
        actionKey: params.actionKey ?? `${params.entityTable}.update`,
        actionKind: 'update',
        sourceType: params.sourceType ?? 'admin_api',
        sourceName: params.sourceName ?? 'global_history',
        rootEntityTable: params.rootEntityTable ?? params.entityTable,
        rootEntityPk: params.rootEntityPk ?? params.entityPk,
        branchId: params.branchId ?? null,
        actors: this.actorList(params.actor),
        entities: [
          {
            key: 'entity',
            entityTable: params.entityTable,
            entityPk: params.entityPk,
            entityLabel: params.entityLabel ?? null,
            entityRole: 'updated',
            rootEntityTable: params.rootEntityTable ?? params.entityTable,
            rootEntityPk: params.rootEntityPk ?? params.entityPk,
            branchId: params.branchId ?? null,
            beforeExists: true,
            afterExists: true,
          },
        ],
        changes,
      },
      params.db ?? this.knex,
    );
  }

  async recordEntityDeleted(params: EntityDeleteHistoryParams): Promise<HistoryEventRow | null> {
    const changes = this.buildEntityChanges({
      entityTable: params.entityTable,
      entityPk: params.entityPk,
      before: params.before,
      after: {},
      fields: params.fields,
      operation: 'delete',
      eventEntityKey: 'entity',
    });

    return this.createEvent(
      {
        actionKey: params.actionKey ?? `${params.entityTable}.delete`,
        actionKind: 'delete',
        sourceType: params.sourceType ?? 'admin_api',
        sourceName: params.sourceName ?? 'global_history',
        rootEntityTable: params.rootEntityTable ?? params.entityTable,
        rootEntityPk: params.rootEntityPk ?? params.entityPk,
        branchId: params.branchId ?? null,
        actors: this.actorList(params.actor),
        entities: [
          {
            key: 'entity',
            entityTable: params.entityTable,
            entityPk: params.entityPk,
            entityLabel: params.entityLabel ?? null,
            entityRole: 'deleted',
            rootEntityTable: params.rootEntityTable ?? params.entityTable,
            rootEntityPk: params.rootEntityPk ?? params.entityPk,
            branchId: params.branchId ?? null,
            beforeExists: true,
            afterExists: false,
          },
        ],
        changes,
      },
      params.db ?? this.knex,
    );
  }

  async recordRelationChanged(params: RelationHistoryParams): Promise<HistoryEventRow> {
    const operation = params.actionKind === 'link' ? 'link' : 'unlink';
    const value =
      params.actionKind === 'link'
        ? {
            valueType: 'reference' as const,
            valueText: params.to.entityPk,
            refTable: params.to.entityTable,
            refPk: params.to.entityPk,
            refLabel: params.to.entityLabel ?? null,
          }
        : { valueType: 'null' as const, valueText: null };

    return this.createEvent(
      {
        actionKey:
          params.actionKey ?? `${params.from.entityTable}.${params.fieldPath}.${params.actionKind}`,
        actionKind: params.actionKind,
        sourceType: params.sourceType ?? 'admin_api',
        sourceName: params.sourceName ?? 'global_history',
        rootEntityTable: params.rootEntityTable ?? params.from.entityTable,
        rootEntityPk: params.rootEntityPk ?? params.from.entityPk,
        branchId: params.branchId ?? null,
        actors: this.actorList(params.actor),
        entities: [
          {
            key: 'from',
            entityTable: params.from.entityTable,
            entityPk: params.from.entityPk,
            entityLabel: params.from.entityLabel ?? null,
            entityRole: params.from.entityRole ?? 'primary_target',
            rootEntityTable: params.rootEntityTable ?? params.from.entityTable,
            rootEntityPk: params.rootEntityPk ?? params.from.entityPk,
            branchId: params.branchId ?? null,
            beforeExists: true,
            afterExists: true,
          },
          {
            key: 'to',
            entityTable: params.to.entityTable,
            entityPk: params.to.entityPk,
            entityLabel: params.to.entityLabel ?? null,
            entityRole: params.to.entityRole ?? (operation === 'link' ? 'linked' : 'unlinked'),
            rootEntityTable: params.rootEntityTable ?? params.from.entityTable,
            rootEntityPk: params.rootEntityPk ?? params.from.entityPk,
            branchId: params.branchId ?? null,
            beforeExists: true,
            afterExists: true,
          },
        ],
        changes: [
          {
            eventEntityKey: 'from',
            entityTable: params.from.entityTable,
            entityPk: params.from.entityPk,
            fieldPath: params.fieldPath,
            operation,
            valueType: operation === 'link' ? 'reference' : 'null',
            oldValue:
              operation === 'unlink'
                ? {
                    valueType: 'reference',
                    valueText: params.to.entityPk,
                    refTable: params.to.entityTable,
                    refPk: params.to.entityPk,
                    refLabel: params.to.entityLabel ?? null,
                  }
                : { valueType: 'null', valueText: null },
            newValue: value,
          },
        ],
      },
      params.db ?? this.knex,
    );
  }

  async createEvent(
    payload: HistoryEventWrite,
    db: HistoryDb = this.knex,
  ): Promise<HistoryEventRow> {
    return db.transaction(async (trx) => {
      const requestContext = getRequestAuditContext();
      const requestId =
        payload.requestId === undefined ? requestContext?.requestId ?? null : payload.requestId;
      const correlationId =
        payload.correlationId === undefined
          ? requestContext?.correlationId ?? null
          : payload.correlationId;
      const httpMethod =
        payload.httpMethod === undefined ? requestContext?.httpMethod ?? null : payload.httpMethod;
      const httpPath =
        payload.httpPath === undefined ? requestContext?.httpPath ?? null : payload.httpPath;
      const ipAddress =
        payload.ipAddress === undefined ? requestContext?.ipAddress ?? null : payload.ipAddress;
      const userAgent =
        payload.userAgent === undefined ? requestContext?.userAgent ?? null : payload.userAgent;
      const previousEvent = await trx<HistoryEventRow>('history_events')
        .select('event_hash')
        .whereNotNull('event_hash')
        .orderBy('occurred_at', 'desc')
        .orderBy('created_at', 'desc')
        .first();

      const eventInsert = {
        occurred_at: payload.occurredAt ?? new Date(),
        action_key: payload.actionKey,
        action_kind: payload.actionKind,
        source_type: payload.sourceType,
        source_name: payload.sourceName ?? null,
        request_id: requestId,
        correlation_id: correlationId,
        idempotency_key: payload.idempotencyKey ?? null,
        http_method: httpMethod,
        http_path: httpPath,
        ip_address: this.toInetOrNull(ipAddress),
        user_agent: userAgent,
        root_entity_table: payload.rootEntityTable ?? null,
        root_entity_pk: payload.rootEntityPk ?? null,
        branch_id: payload.branchId ?? null,
        is_success: payload.isSuccess ?? true,
        failure_code: payload.failureCode ?? null,
        failure_message: payload.failureMessage ?? null,
        previous_event_hash: previousEvent?.event_hash ?? null,
      };

      const [event] = (await trx('history_events')
        .insert(eventInsert)
        .returning('*')) as HistoryEventRow[];

      const eventHash = this.hashEvent(event);
      const [updatedEvent] = (await trx('history_events')
        .where({ id: event.id })
        .update({ event_hash: eventHash })
        .returning('*')) as HistoryEventRow[];

      const eventNode = await this.findOrCreateNode(trx, {
        node_type: 'event',
        label: payload.actionKey,
        event_id: updatedEvent.id,
      });

      for (const actor of payload.actors ?? []) {
        const [actorRow] = (await trx('history_event_actors')
          .insert({
            event_id: updatedEvent.id,
            actor_role: actor.actorRole,
            actor_type: actor.actorType,
            actor_table: actor.actorTable ?? null,
            actor_pk: actor.actorPk ?? null,
            actor_label: actor.actorLabel ?? null,
            auth_subject: actor.authSubject ?? null,
            permission_name: actor.permissionName ?? null,
          })
          .returning('*')) as { id: string; actor_label: string | null; actor_role: string }[];

        const actorNode = await this.findOrCreateNode(trx, {
          node_type: 'actor',
          label: actorRow.actor_label,
          actor_id: actorRow.id,
        });

        await this.createEdge(trx, {
          from_node_id: actorNode.id,
          to_node_id: eventNode.id,
          edge_type: this.actorEdgeType(actor.actorRole),
          event_id: updatedEvent.id,
        });
      }

      const entityKeyToId = new Map<string, string>();
      const entityKeyToNode = new Map<string, HistoryNodeRow>();

      for (const entity of payload.entities ?? []) {
        const [entityRow] = (await trx('history_event_entities')
          .insert({
            event_id: updatedEvent.id,
            entity_table: entity.entityTable,
            entity_pk: entity.entityPk,
            entity_label: entity.entityLabel ?? null,
            entity_role: entity.entityRole,
            root_entity_table: entity.rootEntityTable ?? payload.rootEntityTable ?? null,
            root_entity_pk: entity.rootEntityPk ?? payload.rootEntityPk ?? null,
            branch_id: entity.branchId ?? payload.branchId ?? null,
            before_exists: entity.beforeExists ?? null,
            after_exists: entity.afterExists ?? null,
          })
          .returning('*')) as { id: string; entity_label: string | null; entity_role: string }[];

        const entityNode = await this.findOrCreateNode(trx, {
          node_type: 'entity',
          label: entityRow.entity_label,
          event_entity_id: entityRow.id,
        });

        if (entity.key) {
          entityKeyToId.set(entity.key, entityRow.id);
          entityKeyToNode.set(entity.key, entityNode);
        }

        await this.createEdge(trx, {
          from_node_id: eventNode.id,
          to_node_id: entityNode.id,
          edge_type: this.entityEdgeType(entity.entityRole),
          event_id: updatedEvent.id,
        });
      }

      const inputKeyToNode = new Map<string, HistoryNodeRow>();
      for (const input of payload.inputs ?? []) {
        const prepared = this.prepareScalarValue(input, null);
        const [inputRow] = (await trx('history_event_inputs')
          .insert({
            event_id: updatedEvent.id,
            input_key: input.inputKey,
            value_type: input.valueType,
            value_text: prepared.value_text,
            value_normalized: prepared.value_normalized,
            value_hash: prepared.value_hash,
            is_sensitive: input.isSensitive ?? false,
            ref_table: prepared.ref_table,
            ref_pk: prepared.ref_pk,
            ref_label: prepared.ref_label,
          })
          .returning('*')) as { id: string; input_key: string }[];

        const inputNode = await this.findOrCreateNode(trx, {
          node_type: 'event_input',
          label: input.inputKey,
          event_input_id: inputRow.id,
        });
        inputKeyToNode.set(input.inputKey, inputNode);

        await this.createEdge(trx, {
          from_node_id: eventNode.id,
          to_node_id: inputNode.id,
          edge_type: 'read_from',
          event_id: updatedEvent.id,
        });
      }

      const trackedFields = await this.loadTrackedFieldMap(trx, payload.changes ?? []);
      for (const change of payload.changes ?? []) {
        const trackedField = trackedFields.get(
          this.trackedFieldKey(change.entityTable, change.fieldPath),
        );
        const oldPrepared = this.prepareScalarValue(
          change.oldValue ?? { valueType: change.valueType, valueText: null },
          trackedField ?? null,
        );
        const newPrepared = this.prepareScalarValue(
          change.newValue ?? { valueType: change.valueType, valueText: null },
          trackedField ?? null,
        );

        const [changeRow] = (await trx('history_field_changes')
          .insert({
            event_id: updatedEvent.id,
            event_entity_id: change.eventEntityKey
              ? entityKeyToId.get(change.eventEntityKey) ?? null
              : null,
            entity_table: change.entityTable,
            entity_pk: change.entityPk,
            field_path: change.fieldPath,
            operation: change.operation,
            value_type: change.valueType,
            old_value_text: oldPrepared.value_text,
            old_value_normalized: oldPrepared.value_normalized,
            old_value_hash: oldPrepared.value_hash,
            old_ref_table: oldPrepared.ref_table,
            old_ref_pk: oldPrepared.ref_pk,
            old_ref_label: oldPrepared.ref_label,
            new_value_text: newPrepared.value_text,
            new_value_normalized: newPrepared.value_normalized,
            new_value_hash: newPrepared.value_hash,
            new_ref_table: newPrepared.ref_table,
            new_ref_pk: newPrepared.ref_pk,
            new_ref_label: newPrepared.ref_label,
            is_sensitive: change.isSensitive ?? trackedField?.is_sensitive ?? false,
            changed_at: change.changedAt ?? new Date(),
          })
          .returning('*')) as HistoryFieldChangeRow[];

        const changeNode = await this.findOrCreateNode(trx, {
          node_type: 'field_change',
          label: `${change.entityTable}.${change.fieldPath}`,
          field_change_id: changeRow.id,
        });

        await this.createEdge(trx, {
          from_node_id: eventNode.id,
          to_node_id: changeNode.id,
          edge_type: 'changed',
          event_id: updatedEvent.id,
        });

        if (change.eventEntityKey) {
          const entityNode = entityKeyToNode.get(change.eventEntityKey);
          if (entityNode) {
            await this.createEdge(trx, {
              from_node_id: changeNode.id,
              to_node_id: entityNode.id,
              edge_type: 'affected',
              event_id: updatedEvent.id,
            });
          }
        }

        for (const inputNode of inputKeyToNode.values()) {
          await this.createEdge(trx, {
            from_node_id: changeNode.id,
            to_node_id: inputNode.id,
            edge_type: 'derived_from',
            event_id: updatedEvent.id,
            confidence: 0.5,
          });
        }

        const shouldTrackCurrent =
          change.trackCurrentValue ?? trackedField?.track_current_value ?? true;
        if (shouldTrackCurrent) {
          await this.upsertCurrentValue(trx, change, changeRow, newPrepared);
        }
      }

      return updatedEvent;
    });
  }

  async searchCurrentValues(params: SearchCurrentValuesParams): Promise<{
    rows: HistoryCurrentValueRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = params.offset ?? 0;
    const hashes = this.searchHashes(params.value, params.value_type);
    const partialSearchValue = this.partialSearchValue(params.value, params.value_type);

    if (hashes.length === 0 && partialSearchValue == null) {
      return { rows: [], total: 0, limit, offset };
    }

    const baseQuery = this.knex<HistoryCurrentValueRow>('history_current_values')
      .where((qb) => {
        if (hashes.length > 0) {
          void qb.whereIn('value_hash', hashes);
        }

        if (partialSearchValue != null) {
          void qb.orWhere((textQb) => {
            void textQb
              .whereIn('value_type', this.partialSearchTypes)
              .andWhereRaw("value_normalized LIKE ? ESCAPE E'\\\\'", [
                `%${this.escapeLikePattern(partialSearchValue)}%`,
              ]);
          });
        }
      })
      .modify((qb) => {
        if (params.entity_table) {
          void qb.andWhere('entity_table', params.entity_table);
        }
        if (params.field_path) {
          void qb.andWhere('field_path', params.field_path);
        }
      });

    const [rows, countRow] = await Promise.all([
      baseQuery.clone().orderBy('updated_at', 'desc').limit(limit).offset(offset),
      baseQuery.clone().count<{ count: string }>('id as count').first(),
    ]);

    return {
      rows,
      total: Number(countRow?.count ?? 0),
      limit,
      offset,
    };
  }

  async getValueLineage(
    currentValueId: string,
    depth = 4,
  ): Promise<{
    currentValue: HistoryCurrentValueRow;
    producingChange: HistoryFieldChangeRow | null;
    event: HistoryEventRow | null;
    actors: Record<string, unknown>[];
    entities: Record<string, unknown>[];
    inputs: Record<string, unknown>[];
    changes: HistoryFieldChangeRow[];
    graph: { nodes: HistoryNodeRow[]; edges: HistoryEdgeRow[] };
  }> {
    const currentValue = await this.knex<HistoryCurrentValueRow>('history_current_values')
      .where({ id: currentValueId })
      .first();

    if (!currentValue) {
      throw new NotFoundException({
        message: 'Current history value not found',
        location: 'current_value_id',
      });
    }

    const currentNode = await this.knex<HistoryNodeRow>('history_nodes')
      .where({ current_value_id: currentValue.id })
      .first();
    const changeNode = currentValue.last_change_id
      ? await this.knex<HistoryNodeRow>('history_nodes')
          .where({ field_change_id: currentValue.last_change_id })
          .first()
      : null;
    const startNodeId = currentNode?.id ?? changeNode?.id ?? null;

    const producingChange = currentValue.last_change_id
      ? await this.knex<HistoryFieldChangeRow>('history_field_changes')
          .where({ id: currentValue.last_change_id })
          .first()
      : null;
    const event = producingChange
      ? await this.knex<HistoryEventRow>('history_events')
          .where({ id: producingChange.event_id })
          .first()
      : null;
    const eventDetail = event ? await this.getEventParts(event.id) : this.emptyEventParts();
    const graph = startNodeId
      ? await this.walkGraph(startNodeId, Math.min(Math.max(depth, 1), 8))
      : { nodes: [], edges: [] };

    return {
      currentValue,
      producingChange: producingChange ?? null,
      event: event ?? null,
      ...eventDetail,
      graph,
    };
  }

  async getEntityTimeline(params: EntityTimelineParams): Promise<{
    rows: {
      event: HistoryEventRow;
      entities: Record<string, unknown>[];
      changes: HistoryFieldChangeRow[];
      actors: Record<string, unknown>[];
    }[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = params.offset ?? 0;

    const eventIdRows = await this.knex('history_event_entities')
      .select('event_id')
      .where({
        entity_table: params.entity_table,
        entity_pk: params.entity_pk,
      })
      .union((qb) => {
        void qb.select('event_id').from('history_field_changes').where({
          entity_table: params.entity_table,
          entity_pk: params.entity_pk,
        });
      });

    const eventIds = eventIdRows.map((row: { event_id: string }) => row.event_id);
    if (eventIds.length === 0) {
      return { rows: [], total: 0, limit, offset };
    }

    const baseQuery = this.knex<HistoryEventRow>('history_events').whereIn('id', eventIds);
    const [events, countRow] = await Promise.all([
      baseQuery.clone().orderBy('occurred_at', 'desc').limit(limit).offset(offset),
      baseQuery.clone().count<{ count: string }>('id as count').first(),
    ]);

    const rows = await Promise.all(
      events.map(async (event) => ({
        event,
        ...(await this.getEventParts(event.id)),
      })),
    );

    return {
      rows,
      total: Number(countRow?.count ?? 0),
      limit,
      offset,
    };
  }

  async getEventDetail(eventId: string): Promise<{
    event: HistoryEventRow;
    actors: Record<string, unknown>[];
    entities: Record<string, unknown>[];
    inputs: Record<string, unknown>[];
    changes: HistoryFieldChangeRow[];
    graph: { nodes: HistoryNodeRow[]; edges: HistoryEdgeRow[] };
  }> {
    const event = await this.knex<HistoryEventRow>('history_events').where({ id: eventId }).first();
    if (!event) {
      throw new NotFoundException({
        message: 'History event not found',
        location: 'event_id',
      });
    }

    const eventParts = await this.getEventParts(event.id);
    const graphEdges = await this.knex<HistoryEdgeRow>('history_edges')
      .where({ event_id: event.id })
      .orderBy('created_at', 'asc');
    const graph = await this.nodesForEdges(graphEdges);

    return {
      event,
      ...eventParts,
      graph,
    };
  }

  private async getEventParts(eventId: string): Promise<{
    actors: Record<string, unknown>[];
    entities: Record<string, unknown>[];
    inputs: Record<string, unknown>[];
    changes: HistoryFieldChangeRow[];
  }> {
    const [actors, entities, inputs, changes] = await Promise.all([
      this.knex('history_event_actors').where({ event_id: eventId }).orderBy('id', 'asc'),
      this.knex('history_event_entities').where({ event_id: eventId }).orderBy('created_at', 'asc'),
      this.knex('history_event_inputs').where({ event_id: eventId }).orderBy('input_key', 'asc'),
      this.knex<HistoryFieldChangeRow>('history_field_changes')
        .where({ event_id: eventId })
        .orderBy('changed_at', 'asc'),
    ]);

    return { actors, entities, inputs, changes };
  }

  private emptyEventParts(): {
    actors: Record<string, unknown>[];
    entities: Record<string, unknown>[];
    inputs: Record<string, unknown>[];
    changes: HistoryFieldChangeRow[];
  } {
    return { actors: [], entities: [], inputs: [], changes: [] };
  }

  private actorList(actor?: HistoryActorContext | null): NonNullable<HistoryEventWrite['actors']> {
    if (!actor) {
      return [];
    }

    return [
      {
        actorRole: actor.actorRole ?? 'initiator',
        actorType: actor.actorType ?? 'admin',
        actorTable: actor.actorTable ?? (actor.actorType === 'system' ? null : 'admins'),
        actorPk: actor.actorPk ?? null,
        actorLabel: actor.actorLabel ?? null,
        permissionName: actor.permissionName ?? null,
      },
    ];
  }

  private buildEntityChanges(params: {
    entityTable: string;
    entityPk: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    fields?: string[];
    operation: HistoryOperation;
    eventEntityKey: string;
  }): HistoryFieldChange[] {
    const before = this.flattenEntityValues(params.before);
    const after = this.flattenEntityValues(params.after);
    const fields =
      params.fields ??
      [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
        (field) => !this.isSystemTimestampField(field),
      );

    const changes: HistoryFieldChange[] = [];
    for (const fieldPath of fields) {
      const oldValue = before[fieldPath];
      const newValue = after[fieldPath];
      const isChanged =
        params.operation !== 'update' ||
        this.toComparable(oldValue) !== this.toComparable(newValue);

      if (!isChanged) {
        continue;
      }

      const valueType = this.inferHistoryValueType(fieldPath, newValue ?? oldValue);
      changes.push({
        eventEntityKey: params.eventEntityKey,
        entityTable: params.entityTable,
        entityPk: params.entityPk,
        fieldPath,
        operation: params.operation,
        valueType,
        oldValue: this.toHistoryScalar(fieldPath, valueType, oldValue),
        newValue: this.toHistoryScalar(fieldPath, valueType, newValue),
      });
    }

    return changes;
  }

  private flattenEntityValues(
    values: Record<string, unknown>,
    prefix = '',
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values ?? {})) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (this.isPlainObject(value)) {
        Object.assign(result, this.flattenEntityValues(value, path));
      } else {
        result[path] = value;
      }
    }

    return result;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    return Object.getPrototypeOf(value) === Object.prototype;
  }

  private isSystemTimestampField(field: string): boolean {
    return ['created_at', 'updated_at'].includes(field);
  }

  private toComparable(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return JSON.stringify(value ?? null);
  }

  private toHistoryScalar(
    field: string,
    valueType: HistoryValueType,
    value: unknown,
  ): HistoryScalarValue {
    const refTable = this.referenceTableForField(field);

    return {
      valueType,
      valueText: this.toScalarText(value),
      refTable,
      refPk: valueType === 'reference' && typeof value === 'string' ? value : null,
    };
  }

  private toScalarText(value: unknown): string | number | boolean | Date | null {
    if (value == null) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    return JSON.stringify(value);
  }

  private inferHistoryValueType(field: string, value: unknown): HistoryValueType {
    if (value == null) return 'null';
    if (field.endsWith('_id')) return 'reference';
    if (field.toLowerCase().includes('phone')) return 'phone';
    if (field.toLowerCase().includes('email')) return 'email';
    if (field.toLowerCase().includes('url')) return 'url';
    if (value instanceof Date) return 'timestamp';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'decimal';

    if (typeof value === 'string') {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ) {
        return field.endsWith('_id') ? 'reference' : 'uuid';
      }
      if (/^-?\d+$/.test(value)) return 'integer';
      if (/^-?\d+\.\d+$/.test(value)) return 'decimal';
    }

    return 'text';
  }

  private referenceTableForField(field: string): string | null {
    const fieldParts = field.split('.');
    const normalizedField = fieldParts[fieldParts.length - 1] ?? field;
    const references: Record<string, string> = {
      user_id: 'users',
      branch_id: 'branches',
      phone_category_id: 'phone_categories',
      phone_os_type_id: 'phone_os_types',
      problem_category_id: 'problem_categories',
      repair_part_id: 'repair_parts',
      status_id: 'repair_order_statuses',
      reject_cause_id: 'repair_order_reject_causes',
      region_id: 'repair_order_regions',
      created_by: 'admins',
      updated_by: 'admins',
      admin_id: 'admins',
      role_id: 'roles',
      permission_id: 'permissions',
    };

    return references[normalizedField] ?? null;
  }

  private async walkGraph(
    startNodeId: string,
    depth: number,
  ): Promise<{ nodes: HistoryNodeRow[]; edges: HistoryEdgeRow[] }> {
    const result = await this.knex.raw<{ rows: HistoryEdgeRow[] }>(
      `
        WITH RECURSIVE walk(node_id, depth, path) AS (
          SELECT ?::uuid, 0, ARRAY[?::uuid]
          UNION ALL
          SELECT
            CASE
              WHEN e.from_node_id = walk.node_id THEN e.to_node_id
              ELSE e.from_node_id
            END,
            walk.depth + 1,
            walk.path || CASE
              WHEN e.from_node_id = walk.node_id THEN e.to_node_id
              ELSE e.from_node_id
            END
          FROM walk
          JOIN history_edges e
            ON e.from_node_id = walk.node_id OR e.to_node_id = walk.node_id
          WHERE walk.depth < ?
            AND NOT (
              CASE
                WHEN e.from_node_id = walk.node_id THEN e.to_node_id
                ELSE e.from_node_id
              END = ANY(walk.path)
            )
        )
        SELECT DISTINCT e.*
        FROM history_edges e
        JOIN walk w ON e.from_node_id = w.node_id OR e.to_node_id = w.node_id
        ORDER BY e.created_at ASC
      `,
      [startNodeId, startNodeId, depth],
    );

    return this.nodesForEdges(result.rows, startNodeId);
  }

  private async nodesForEdges(
    edges: HistoryEdgeRow[],
    extraNodeId?: string,
  ): Promise<{ nodes: HistoryNodeRow[]; edges: HistoryEdgeRow[] }> {
    const nodeIds = new Set<string>();
    if (extraNodeId) {
      nodeIds.add(extraNodeId);
    }
    for (const edge of edges) {
      nodeIds.add(edge.from_node_id);
      nodeIds.add(edge.to_node_id);
    }

    const nodes =
      nodeIds.size > 0
        ? await this.knex<HistoryNodeRow>('history_nodes').whereIn('id', [...nodeIds])
        : [];

    return { nodes, edges };
  }

  private async upsertCurrentValue(
    trx: Knex.Transaction,
    change: HistoryFieldChange,
    changeRow: HistoryFieldChangeRow,
    newPrepared: PreparedScalarValue,
  ): Promise<void> {
    const shouldDeleteCurrent =
      (change.operation === 'delete' || change.operation === 'unlink') &&
      !newPrepared.value_hash &&
      !newPrepared.ref_pk;

    if (shouldDeleteCurrent) {
      await trx('history_current_values')
        .where({
          entity_table: change.entityTable,
          entity_pk: change.entityPk,
          field_path: change.fieldPath,
        })
        .del();
      return;
    }

    const payload = {
      entity_table: change.entityTable,
      entity_pk: change.entityPk,
      field_path: change.fieldPath,
      value_type: change.valueType,
      value_text: newPrepared.value_text,
      value_normalized: newPrepared.value_normalized,
      value_hash: newPrepared.value_hash,
      ref_table: newPrepared.ref_table,
      ref_pk: newPrepared.ref_pk,
      ref_label: newPrepared.ref_label,
      last_change_id: changeRow.id,
      current_since: changeRow.changed_at,
      updated_at: trx.fn.now(),
    };

    const [currentValue] = (await trx('history_current_values')
      .insert(payload)
      .onConflict(['entity_table', 'entity_pk', 'field_path'])
      .merge(payload)
      .returning('*')) as HistoryCurrentValueRow[];

    const currentValueNode = await this.findOrCreateNode(trx, {
      node_type: 'current_value',
      label: `${currentValue.entity_table}.${currentValue.field_path}`,
      current_value_id: currentValue.id,
    });
    const changeNode = await this.findOrCreateNode(trx, {
      node_type: 'field_change',
      label: `${change.entityTable}.${change.fieldPath}`,
      field_change_id: changeRow.id,
    });

    await this.createEdge(trx, {
      from_node_id: currentValueNode.id,
      to_node_id: changeNode.id,
      edge_type: 'current_value_of',
      event_id: changeRow.event_id,
    });
  }

  private async findOrCreateNode(
    trx: Knex.Transaction,
    row: Partial<HistoryNodeRow> & { node_type: HistoryNodeRow['node_type'] },
  ): Promise<HistoryNodeRow> {
    const lookup = this.nodeLookup(row);
    if (!lookup) {
      throw new BadRequestException({
        message: 'History node requires a referenced row id',
        location: 'history_node',
      });
    }

    const existing = await trx<HistoryNodeRow>('history_nodes').where(lookup).first();
    if (existing) {
      return existing;
    }

    const [node] = (await trx('history_nodes')
      .insert({
        node_type: row.node_type,
        label: row.label ?? null,
        event_id: row.event_id ?? null,
        actor_id: row.actor_id ?? null,
        event_entity_id: row.event_entity_id ?? null,
        field_change_id: row.field_change_id ?? null,
        current_value_id: row.current_value_id ?? null,
        event_input_id: row.event_input_id ?? null,
      })
      .returning('*')) as HistoryNodeRow[];

    return node;
  }

  private nodeLookup(row: Partial<HistoryNodeRow>): Partial<HistoryNodeRow> | null {
    if (row.event_id) return { event_id: row.event_id };
    if (row.actor_id) return { actor_id: row.actor_id };
    if (row.event_entity_id) return { event_entity_id: row.event_entity_id };
    if (row.field_change_id) return { field_change_id: row.field_change_id };
    if (row.current_value_id) return { current_value_id: row.current_value_id };
    if (row.event_input_id) return { event_input_id: row.event_input_id };
    return null;
  }

  private async createEdge(
    trx: Knex.Transaction,
    edge: {
      from_node_id: string;
      to_node_id: string;
      edge_type: HistoryEdgeType;
      event_id?: string | null;
      confidence?: number;
      note?: string | null;
    },
  ): Promise<void> {
    if (edge.from_node_id === edge.to_node_id) {
      return;
    }

    await trx('history_edges').insert({
      from_node_id: edge.from_node_id,
      to_node_id: edge.to_node_id,
      edge_type: edge.edge_type,
      event_id: edge.event_id ?? null,
      confidence: edge.confidence ?? 1,
      note: edge.note ?? null,
    });
  }

  private async loadTrackedFieldMap(
    trx: Knex.Transaction,
    changes: HistoryFieldChange[],
  ): Promise<Map<string, HistoryTrackedFieldRow>> {
    const pairs = changes.map((change) => ({
      entity_table: change.entityTable,
      field_path: change.fieldPath,
    }));

    if (pairs.length === 0) {
      return new Map();
    }

    const rows = await trx<HistoryTrackedFieldRow>('history_tracked_fields')
      .where({ is_active: true })
      .where((qb) => {
        for (const pair of pairs) {
          void qb.orWhere((inner) => {
            void inner
              .where('entity_table', pair.entity_table)
              .andWhere('field_path', pair.field_path);
          });
        }
      });

    return new Map(
      rows.map((row) => [this.trackedFieldKey(row.entity_table, row.field_path), row]),
    );
  }

  private prepareScalarValue(
    value: HistoryScalarValue,
    trackedField: HistoryTrackedFieldRow | null,
  ): PreparedScalarValue {
    const valueType = value.valueType;
    const rawText = this.valueToText(value.valueText);
    const rawNormalized =
      value.valueNormalized ??
      this.normalizeValue(
        value.refPk ?? rawText,
        trackedField?.value_type ?? valueType,
        trackedField?.normalizer_key ?? null,
      );
    const rawHash = rawNormalized == null ? null : this.sha256(rawNormalized);
    const strategy = trackedField?.redaction_strategy ?? 'none';

    if (strategy === 'omit') {
      return {
        value_text: null,
        value_normalized: null,
        value_hash: null,
        ref_table: value.refTable ?? trackedField?.ref_table ?? null,
        ref_pk: null,
        ref_label: null,
      };
    }

    if (strategy === 'hash_only') {
      return {
        value_text: null,
        value_normalized: null,
        value_hash: rawHash,
        ref_table: value.refTable ?? trackedField?.ref_table ?? null,
        ref_pk: value.refPk ?? null,
        ref_label: null,
      };
    }

    if (strategy === 'mask') {
      return {
        value_text: rawText == null ? null : this.maskValue(rawText),
        value_normalized: null,
        value_hash: rawHash,
        ref_table: value.refTable ?? trackedField?.ref_table ?? null,
        ref_pk: value.refPk ?? null,
        ref_label: value.refLabel ?? null,
      };
    }

    return {
      value_text: rawText,
      value_normalized: rawNormalized,
      value_hash: rawHash,
      ref_table: value.refTable ?? trackedField?.ref_table ?? null,
      ref_pk: value.refPk ?? null,
      ref_label: value.refLabel ?? null,
    };
  }

  private searchHashes(value: string, valueType?: HistoryValueType): string[] {
    const types = valueType ? [valueType] : this.fallbackSearchTypes;
    const hashes = new Set<string>();

    for (const type of types) {
      const normalized = this.normalizeValue(value, type, null);
      if (normalized != null) {
        hashes.add(this.sha256(normalized));
      }

      if (type === 'phone') {
        const uzPhone = this.normalizeValue(value, type, 'uz_phone_e164');
        if (uzPhone != null) {
          hashes.add(this.sha256(uzPhone));
        }
      }
    }

    return [...hashes];
  }

  private partialSearchValue(value: string, valueType?: HistoryValueType): string | null {
    if (valueType && !this.partialSearchTypes.includes(valueType)) {
      return null;
    }

    const normalized = this.normalizeValue(value, valueType ?? 'text', null);
    return normalized === '' ? null : normalized;
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }

  private normalizeValue(
    value: string | null,
    valueType: HistoryValueType,
    normalizerKey: string | null,
  ): string | null {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return '';
    }

    switch (valueType) {
      case 'null':
        return null;
      case 'phone':
        return this.normalizePhone(trimmed, normalizerKey);
      case 'email':
        return trimmed.toLowerCase();
      case 'uuid':
        return trimmed.toLowerCase();
      case 'integer':
        return /^-?\d+$/.test(trimmed) ? String(Number.parseInt(trimmed, 10)) : trimmed;
      case 'decimal':
      case 'money':
        return trimmed.replace(/\s/g, '').replace(',', '.');
      case 'boolean':
        return this.normalizeBoolean(trimmed);
      case 'date':
        return this.normalizeDate(trimmed, false);
      case 'timestamp':
        return this.normalizeDate(trimmed, true);
      case 'url':
        return this.normalizeUrl(trimmed);
      case 'reference':
        return trimmed;
      case 'string':
      case 'text':
      case 'enum':
      case 'file':
      default:
        return trimmed.toLowerCase();
    }
  }

  private normalizePhone(value: string, normalizerKey: string | null): string {
    const digits = value.replace(/\D/g, '');

    if (normalizerKey === 'uz_phone_e164') {
      if (digits.length === 9) {
        return `+998${digits}`;
      }
      if (digits.length === 12 && digits.startsWith('998')) {
        return `+${digits}`;
      }
    }

    if (value.startsWith('+') && digits.length > 0) {
      return `+${digits}`;
    }

    return digits;
  }

  private normalizeBoolean(value: string): string {
    const lower = value.toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(lower)) {
      return 'true';
    }
    if (['false', '0', 'no', 'n', 'off'].includes(lower)) {
      return 'false';
    }
    return lower;
  }

  private normalizeDate(value: string, includeTime: boolean): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return includeTime ? date.toISOString() : date.toISOString().slice(0, 10);
  }

  private normalizeUrl(value: string): string {
    try {
      const url = new URL(value);
      url.protocol = url.protocol.toLowerCase();
      url.hostname = url.hostname.toLowerCase();
      return url.toString().replace(/\/$/, '');
    } catch {
      return value.toLowerCase();
    }
  }

  private valueToText(value: string | number | boolean | Date | null | undefined): string | null {
    if (value == null) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }

  private maskValue(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }

    return `${value.slice(0, 2)}${'*'.repeat(Math.min(value.length - 4, 8))}${value.slice(-2)}`;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashEvent(event: HistoryEventRow): string {
    return this.sha256(
      [
        event.id,
        new Date(event.occurred_at).toISOString(),
        event.action_key,
        event.action_kind,
        event.source_type,
        event.source_name ?? '',
        event.request_id ?? '',
        event.correlation_id ?? '',
        event.root_entity_table ?? '',
        event.root_entity_pk ?? '',
        event.previous_event_hash ?? '',
      ].join('|'),
    );
  }

  private trackedFieldKey(entityTable: string, fieldPath: string): string {
    return `${entityTable}.${fieldPath}`;
  }

  private toInetOrNull(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    return isIP(value) ? value : null;
  }

  private actorEdgeType(actorRole: string): HistoryEdgeType {
    return actorRole === 'initiator' ? 'initiated' : 'executed';
  }

  private entityEdgeType(entityRole: string): HistoryEdgeType {
    if (entityRole === 'created') return 'created';
    if (entityRole === 'deleted') return 'deleted';
    if (entityRole === 'linked') return 'linked';
    if (entityRole === 'unlinked') return 'unlinked';
    if (entityRole === 'notification_target') return 'notified';
    return 'affected';
  }
}
