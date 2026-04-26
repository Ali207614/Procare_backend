exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS history_tracked_fields (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

      entity_table varchar(120) NOT NULL,
      field_path varchar(240) NOT NULL,
      value_type varchar(40) NOT NULL,

      is_active boolean NOT NULL DEFAULT true,
      is_sensitive boolean NOT NULL DEFAULT false,
      track_current_value boolean NOT NULL DEFAULT true,
      capture_old_value boolean NOT NULL DEFAULT true,
      capture_new_value boolean NOT NULL DEFAULT true,

      ref_table varchar(120),
      normalizer_key varchar(80),
      redaction_strategy varchar(40) NOT NULL DEFAULT 'none',

      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),

      UNIQUE (entity_table, field_path),
      CHECK (redaction_strategy IN ('none', 'mask', 'hash_only', 'omit')),
      CHECK (value_type IN ('null', 'string', 'text', 'uuid', 'integer', 'decimal', 'money', 'boolean', 'date', 'timestamp', 'enum', 'phone', 'email', 'url', 'file', 'reference'))
    );

    CREATE TABLE IF NOT EXISTS history_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      occurred_at timestamptz NOT NULL DEFAULT now(),

      action_key varchar(160) NOT NULL,
      action_kind varchar(40) NOT NULL,
      source_type varchar(40) NOT NULL,
      source_name varchar(160),

      request_id varchar(120),
      correlation_id varchar(120),
      idempotency_key varchar(160),

      http_method varchar(12),
      http_path text,
      ip_address inet,
      user_agent text,

      ip_country_code varchar(2),
      ip_country_name varchar(120),
      ip_region text,
      ip_city text,
      ip_latitude numeric(9,6),
      ip_longitude numeric(9,6),
      ip_timezone varchar(80),
      ip_isp text,
      ip_org text,
      ip_asn varchar(40),
      ip_is_vpn boolean,
      ip_is_proxy boolean,
      ip_is_tor boolean,
      ip_geo_provider varchar(80),
      ip_geo_confidence numeric(5,4),
      ip_geo_resolved_at timestamptz,

      root_entity_table varchar(120),
      root_entity_pk text,
      branch_id text,

      is_success boolean NOT NULL DEFAULT true,
      failure_code varchar(120),
      failure_message text,

      previous_event_hash char(64),
      event_hash char(64),
      created_at timestamptz NOT NULL DEFAULT now(),

      CHECK (action_kind IN ('create', 'update', 'delete', 'link', 'unlink', 'move', 'login', 'logout', 'sync', 'job', 'webhook', 'read_sensitive', 'other')),
      CHECK (source_type IN ('admin_api', 'user_api', 'system_job', 'cron', 'webhook', 'seed', 'script', 'migration', 'integration', 'unknown'))
    );

    CREATE TABLE IF NOT EXISTS history_event_actors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,

      actor_role varchar(40) NOT NULL,
      actor_type varchar(40) NOT NULL,
      actor_table varchar(120),
      actor_pk text,
      actor_label text,

      auth_subject text,
      permission_name text,

      CHECK (actor_role IN ('initiator', 'executor', 'approver', 'system', 'external_source', 'impersonated_by')),
      CHECK (actor_type IN ('admin', 'user', 'system', 'cron', 'webhook', 'integration', 'script', 'migration', 'unknown'))
    );

    CREATE TABLE IF NOT EXISTS history_event_entities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,

      entity_table varchar(120) NOT NULL,
      entity_pk text NOT NULL,
      entity_label text,
      entity_role varchar(50) NOT NULL,

      root_entity_table varchar(120),
      root_entity_pk text,
      branch_id text,

      before_exists boolean,
      after_exists boolean,
      created_at timestamptz NOT NULL DEFAULT now(),

      CHECK (entity_role IN (
        'primary_target',
        'created',
        'updated',
        'deleted',
        'linked',
        'unlinked',
        'affected',
        'victim',
        'read_dependency',
        'permission_dependency',
        'workflow_dependency',
        'external_reference',
        'notification_target',
        'derived_output'
      ))
    );

    CREATE TABLE IF NOT EXISTS history_field_changes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,
      event_entity_id uuid REFERENCES history_event_entities(id) ON DELETE SET NULL,

      entity_table varchar(120) NOT NULL,
      entity_pk text NOT NULL,
      field_path varchar(240) NOT NULL,
      operation varchar(30) NOT NULL,

      value_type varchar(40) NOT NULL,

      old_value_text text,
      old_value_normalized text,
      old_value_hash char(64),
      old_ref_table varchar(120),
      old_ref_pk text,
      old_ref_label text,

      new_value_text text,
      new_value_normalized text,
      new_value_hash char(64),
      new_ref_table varchar(120),
      new_ref_pk text,
      new_ref_label text,

      is_sensitive boolean NOT NULL DEFAULT false,
      changed_at timestamptz NOT NULL DEFAULT now(),

      CHECK (operation IN ('insert', 'update', 'delete', 'link', 'unlink', 'touch')),
      CHECK (value_type IN ('null', 'string', 'text', 'uuid', 'integer', 'decimal', 'money', 'boolean', 'date', 'timestamp', 'enum', 'phone', 'email', 'url', 'file', 'reference'))
    );

    CREATE TABLE IF NOT EXISTS history_current_values (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

      entity_table varchar(120) NOT NULL,
      entity_pk text NOT NULL,
      field_path varchar(240) NOT NULL,

      value_type varchar(40) NOT NULL,
      value_text text,
      value_normalized text,
      value_hash char(64),

      ref_table varchar(120),
      ref_pk text,
      ref_label text,

      last_change_id uuid REFERENCES history_field_changes(id) ON DELETE SET NULL,
      current_since timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),

      UNIQUE (entity_table, entity_pk, field_path),
      CHECK (value_type IN ('null', 'string', 'text', 'uuid', 'integer', 'decimal', 'money', 'boolean', 'date', 'timestamp', 'enum', 'phone', 'email', 'url', 'file', 'reference'))
    );

    CREATE TABLE IF NOT EXISTS history_event_inputs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,

      input_key varchar(240) NOT NULL,
      value_type varchar(40) NOT NULL,
      value_text text,
      value_normalized text,
      value_hash char(64),
      is_sensitive boolean NOT NULL DEFAULT false,

      ref_table varchar(120),
      ref_pk text,
      ref_label text,

      CHECK (value_type IN ('null', 'string', 'text', 'uuid', 'integer', 'decimal', 'money', 'boolean', 'date', 'timestamp', 'enum', 'phone', 'email', 'url', 'file', 'reference'))
    );

    CREATE TABLE IF NOT EXISTS history_nodes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      node_type varchar(40) NOT NULL,
      label text,

      event_id uuid REFERENCES history_events(id) ON DELETE CASCADE,
      actor_id uuid REFERENCES history_event_actors(id) ON DELETE CASCADE,
      event_entity_id uuid REFERENCES history_event_entities(id) ON DELETE CASCADE,
      field_change_id uuid REFERENCES history_field_changes(id) ON DELETE CASCADE,
      current_value_id uuid REFERENCES history_current_values(id) ON DELETE CASCADE,
      event_input_id uuid REFERENCES history_event_inputs(id) ON DELETE CASCADE,

      created_at timestamptz NOT NULL DEFAULT now(),

      CHECK (node_type IN ('event', 'actor', 'entity', 'field_change', 'current_value', 'event_input'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS history_nodes_event_uidx
      ON history_nodes (event_id) WHERE event_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS history_nodes_actor_uidx
      ON history_nodes (actor_id) WHERE actor_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS history_nodes_entity_uidx
      ON history_nodes (event_entity_id) WHERE event_entity_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS history_nodes_change_uidx
      ON history_nodes (field_change_id) WHERE field_change_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS history_nodes_current_value_uidx
      ON history_nodes (current_value_id) WHERE current_value_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS history_nodes_input_uidx
      ON history_nodes (event_input_id) WHERE event_input_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS history_edges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

      from_node_id uuid NOT NULL REFERENCES history_nodes(id) ON DELETE CASCADE,
      to_node_id uuid NOT NULL REFERENCES history_nodes(id) ON DELETE CASCADE,
      edge_type varchar(60) NOT NULL,

      event_id uuid REFERENCES history_events(id) ON DELETE SET NULL,
      confidence numeric(5,4) NOT NULL DEFAULT 1,
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),

      CHECK (edge_type IN (
        'initiated',
        'executed',
        'changed',
        'created',
        'deleted',
        'linked',
        'unlinked',
        'replaced',
        'derived_from',
        'allowed_by',
        'blocked_by',
        'read_from',
        'affected',
        'notified',
        'current_value_of'
      ))
    );

    CREATE INDEX IF NOT EXISTS history_events_time_idx
      ON history_events (occurred_at DESC);
    CREATE INDEX IF NOT EXISTS history_events_root_idx
      ON history_events (root_entity_table, root_entity_pk, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS history_events_request_idx
      ON history_events (request_id);
    CREATE INDEX IF NOT EXISTS history_events_correlation_idx
      ON history_events (correlation_id);

    CREATE INDEX IF NOT EXISTS history_tracked_fields_active_idx
      ON history_tracked_fields (entity_table, is_active);

    CREATE INDEX IF NOT EXISTS history_event_actors_event_idx
      ON history_event_actors (event_id);
    CREATE INDEX IF NOT EXISTS history_events_actor_lookup_idx
      ON history_event_actors (actor_type, actor_pk);

    CREATE INDEX IF NOT EXISTS history_entities_lookup_idx
      ON history_event_entities (entity_table, entity_pk, event_id);
    CREATE INDEX IF NOT EXISTS history_entities_event_idx
      ON history_event_entities (event_id);
    CREATE INDEX IF NOT EXISTS history_entities_role_idx
      ON history_event_entities (entity_role, entity_table);

    CREATE INDEX IF NOT EXISTS history_changes_event_idx
      ON history_field_changes (event_id);
    CREATE INDEX IF NOT EXISTS history_changes_entity_field_time_idx
      ON history_field_changes (entity_table, entity_pk, field_path, changed_at DESC);
    CREATE INDEX IF NOT EXISTS history_changes_new_value_idx
      ON history_field_changes (new_value_hash, entity_table, field_path);
    CREATE INDEX IF NOT EXISTS history_changes_old_value_idx
      ON history_field_changes (old_value_hash, entity_table, field_path);

    CREATE INDEX IF NOT EXISTS history_current_value_hash_idx
      ON history_current_values (value_hash);
    CREATE INDEX IF NOT EXISTS history_current_entity_idx
      ON history_current_values (entity_table, entity_pk);
    CREATE INDEX IF NOT EXISTS history_current_last_change_idx
      ON history_current_values (last_change_id);

    CREATE INDEX IF NOT EXISTS history_inputs_event_idx
      ON history_event_inputs (event_id);
    CREATE INDEX IF NOT EXISTS history_inputs_value_hash_idx
      ON history_event_inputs (value_hash);

    CREATE INDEX IF NOT EXISTS history_edges_event_idx
      ON history_edges (event_id);
    CREATE INDEX IF NOT EXISTS history_edges_from_idx
      ON history_edges (from_node_id, edge_type);
    CREATE INDEX IF NOT EXISTS history_edges_to_idx
      ON history_edges (to_node_id, edge_type);
  `);

  const trackedFields = [
    {
      entity_table: 'repair_orders',
      field_path: 'number_id',
      value_type: 'integer',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'user_id',
      value_type: 'reference',
      ref_table: 'users',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'branch_id',
      value_type: 'reference',
      ref_table: 'branches',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'phone_category_id',
      value_type: 'reference',
      ref_table: 'phone_categories',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'status_id',
      value_type: 'reference',
      ref_table: 'repair_order_statuses',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'total',
      value_type: 'money',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'phone_number',
      value_type: 'phone',
      is_sensitive: true,
      normalizer_key: 'uz_phone_e164',
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'name',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'imei',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'priority',
      value_type: 'enum',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'source',
      value_type: 'enum',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'agreed_date',
      value_type: 'timestamp',
    },
    {
      entity_table: 'repair_orders',
      field_path: 'description',
      value_type: 'text',
    },
    {
      entity_table: 'admins',
      field_path: 'phone_number',
      value_type: 'phone',
      is_sensitive: true,
      normalizer_key: 'uz_phone_e164',
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'admins',
      field_path: 'first_name',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'admins',
      field_path: 'last_name',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'admins',
      field_path: 'password',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'omit',
      track_current_value: false,
    },
    {
      entity_table: 'admins',
      field_path: 'work_days.monday',
      value_type: 'boolean',
    },
    {
      entity_table: 'admins',
      field_path: 'work_days.tuesday',
      value_type: 'boolean',
    },
    {
      entity_table: 'admins',
      field_path: 'work_days.wednesday',
      value_type: 'boolean',
    },
    {
      entity_table: 'admins',
      field_path: 'work_days.thursday',
      value_type: 'boolean',
    },
    {
      entity_table: 'admins',
      field_path: 'work_days.friday',
      value_type: 'boolean',
    },
    {
      entity_table: 'admins',
      field_path: 'work_days.saturday',
      value_type: 'boolean',
    },
    {
      entity_table: 'admins',
      field_path: 'work_days.sunday',
      value_type: 'boolean',
    },
    {
      entity_table: 'users',
      field_path: 'customer_code',
      value_type: 'string',
    },
    {
      entity_table: 'users',
      field_path: 'phone_number1',
      value_type: 'phone',
      is_sensitive: true,
      normalizer_key: 'uz_phone_e164',
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'users',
      field_path: 'phone_number2',
      value_type: 'phone',
      is_sensitive: true,
      normalizer_key: 'uz_phone_e164',
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'users',
      field_path: 'first_name',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'users',
      field_path: 'last_name',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'users',
      field_path: 'passport_series',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'hash_only',
    },
    {
      entity_table: 'users',
      field_path: 'id_card_number',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'hash_only',
    },
    {
      entity_table: 'roles',
      field_path: 'name',
      value_type: 'string',
    },
    {
      entity_table: 'permissions',
      field_path: 'name',
      value_type: 'string',
    },
    {
      entity_table: 'phone_os_types',
      field_path: 'name_uz',
      value_type: 'string',
    },
    {
      entity_table: 'phone_os_types',
      field_path: 'name_ru',
      value_type: 'string',
    },
    {
      entity_table: 'phone_os_types',
      field_path: 'name_en',
      value_type: 'string',
    },
    {
      entity_table: 'phone_os_types',
      field_path: 'sort',
      value_type: 'integer',
    },
    {
      entity_table: 'phone_os_types',
      field_path: 'is_active',
      value_type: 'boolean',
    },
    {
      entity_table: 'phone_os_types',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'phone_os_types',
      field_path: 'created_by',
      value_type: 'reference',
      ref_table: 'admins',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'name_uz',
      value_type: 'string',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'name_ru',
      value_type: 'string',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'name_en',
      value_type: 'string',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'telegram_sticker',
      value_type: 'string',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'phone_os_type_id',
      value_type: 'reference',
      ref_table: 'phone_os_types',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'parent_id',
      value_type: 'reference',
      ref_table: 'phone_categories',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'sort',
      value_type: 'integer',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'is_active',
      value_type: 'boolean',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'phone_categories',
      field_path: 'created_by',
      value_type: 'reference',
      ref_table: 'admins',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'name_uz',
      value_type: 'string',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'name_ru',
      value_type: 'string',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'name_en',
      value_type: 'string',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'parent_id',
      value_type: 'reference',
      ref_table: 'problem_categories',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'price',
      value_type: 'money',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'estimated_minutes',
      value_type: 'integer',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'sort',
      value_type: 'integer',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'is_active',
      value_type: 'boolean',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'problem_categories',
      field_path: 'created_by',
      value_type: 'reference',
      ref_table: 'admins',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'part_name_uz',
      value_type: 'string',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'part_name_ru',
      value_type: 'string',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'part_name_en',
      value_type: 'string',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'part_price',
      value_type: 'money',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'quantity',
      value_type: 'integer',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'description_uz',
      value_type: 'text',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'description_ru',
      value_type: 'text',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'description_en',
      value_type: 'text',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'repair_parts',
      field_path: 'created_by',
      value_type: 'reference',
      ref_table: 'admins',
    },
    {
      entity_table: 'branches',
      field_path: 'name_uz',
      value_type: 'string',
    },
    {
      entity_table: 'branches',
      field_path: 'name_ru',
      value_type: 'string',
    },
    {
      entity_table: 'branches',
      field_path: 'name_en',
      value_type: 'string',
    },
    {
      entity_table: 'branches',
      field_path: 'address_uz',
      value_type: 'text',
    },
    {
      entity_table: 'branches',
      field_path: 'address_ru',
      value_type: 'text',
    },
    {
      entity_table: 'branches',
      field_path: 'address_en',
      value_type: 'text',
    },
    {
      entity_table: 'branches',
      field_path: 'support_phone',
      value_type: 'phone',
      normalizer_key: 'uz_phone_e164',
    },
    {
      entity_table: 'branches',
      field_path: 'lat',
      value_type: 'decimal',
    },
    {
      entity_table: 'branches',
      field_path: 'long',
      value_type: 'decimal',
    },
    {
      entity_table: 'branches',
      field_path: 'work_start_time',
      value_type: 'string',
    },
    {
      entity_table: 'branches',
      field_path: 'work_end_time',
      value_type: 'string',
    },
    {
      entity_table: 'branches',
      field_path: 'bg_color',
      value_type: 'string',
    },
    {
      entity_table: 'branches',
      field_path: 'color',
      value_type: 'string',
    },
    {
      entity_table: 'branches',
      field_path: 'is_protected',
      value_type: 'boolean',
    },
    {
      entity_table: 'branches',
      field_path: 'can_user_view',
      value_type: 'boolean',
    },
    {
      entity_table: 'branches',
      field_path: 'sort',
      value_type: 'integer',
    },
    {
      entity_table: 'branches',
      field_path: 'is_active',
      value_type: 'boolean',
    },
    {
      entity_table: 'branches',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'branches',
      field_path: 'created_by',
      value_type: 'reference',
      ref_table: 'admins',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'name_uz',
      value_type: 'string',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'name_ru',
      value_type: 'string',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'name_en',
      value_type: 'string',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'bg_color',
      value_type: 'string',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'color',
      value_type: 'string',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'sort',
      value_type: 'integer',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'can_user_view',
      value_type: 'boolean',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'can_add_payment',
      value_type: 'boolean',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'is_active',
      value_type: 'boolean',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'is_protected',
      value_type: 'boolean',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'type',
      value_type: 'enum',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'branch_id',
      value_type: 'reference',
      ref_table: 'branches',
    },
    {
      entity_table: 'repair_order_statuses',
      field_path: 'created_by',
      value_type: 'reference',
      ref_table: 'admins',
    },
    {
      entity_table: 'repair_order_reject_causes',
      field_path: 'name',
      value_type: 'string',
    },
    {
      entity_table: 'repair_order_reject_causes',
      field_path: 'description',
      value_type: 'text',
    },
    {
      entity_table: 'repair_order_reject_causes',
      field_path: 'sort',
      value_type: 'integer',
    },
    {
      entity_table: 'repair_order_reject_causes',
      field_path: 'is_active',
      value_type: 'boolean',
    },
    {
      entity_table: 'repair_order_reject_causes',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'repair_order_regions',
      field_path: 'title',
      value_type: 'string',
    },
    {
      entity_table: 'repair_order_regions',
      field_path: 'description',
      value_type: 'text',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'name',
      value_type: 'string',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'brand',
      value_type: 'string',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'model',
      value_type: 'string',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'imei',
      value_type: 'string',
      is_sensitive: true,
      redaction_strategy: 'mask',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'color',
      value_type: 'string',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'storage_capacity',
      value_type: 'string',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'battery_capacity',
      value_type: 'string',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'is_free',
      value_type: 'boolean',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'daily_rent_price',
      value_type: 'money',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'deposit_amount',
      value_type: 'money',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'currency',
      value_type: 'enum',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'is_available',
      value_type: 'boolean',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'status',
      value_type: 'enum',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'condition',
      value_type: 'enum',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'quantity',
      value_type: 'integer',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'quantity_available',
      value_type: 'integer',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'notes',
      value_type: 'text',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'specifications',
      value_type: 'text',
    },
    {
      entity_table: 'rental_phone_devices',
      field_path: 'sort',
      value_type: 'integer',
    },
  ];

  await knex('history_tracked_fields')
    .insert(
      trackedFields.map((field) => ({
        is_active: true,
        is_sensitive: false,
        track_current_value: true,
        capture_old_value: true,
        capture_new_value: true,
        redaction_strategy: 'none',
        ...field,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })),
    )
    .onConflict(['entity_table', 'field_path'])
    .merge({
      value_type: knex.raw('excluded.value_type'),
      is_active: knex.raw('excluded.is_active'),
      is_sensitive: knex.raw('excluded.is_sensitive'),
      track_current_value: knex.raw('excluded.track_current_value'),
      capture_old_value: knex.raw('excluded.capture_old_value'),
      capture_new_value: knex.raw('excluded.capture_new_value'),
      ref_table: knex.raw('excluded.ref_table'),
      normalizer_key: knex.raw('excluded.normalizer_key'),
      redaction_strategy: knex.raw('excluded.redaction_strategy'),
      updated_at: knex.fn.now(),
    });

  const historyPermissionId = '00000000-0000-4000-8000-000000000096';

  await knex('permissions')
    .insert({
      id: historyPermissionId,
      name: 'history.view',
      description: 'View history and lineage records',
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
    .onConflict('name')
    .merge({
      description: 'View history and lineage records',
      is_active: true,
      status: 'Open',
      updated_at: knex.fn.now(),
    });

  const historyPermission = await knex('permissions')
    .select('id')
    .where({ name: 'history.view' })
    .first();
  const superAdminRole = await knex('roles')
    .select('id')
    .where({ id: '00000000-0000-4000-8000-000000000000' })
    .orWhere({ name: 'Super Admin' })
    .first();

  if (superAdminRole) {
    await knex('role_permissions')
      .insert({
        role_id: superAdminRole.id,
        permission_id: historyPermission?.id ?? historyPermissionId,
      })
      .onConflict(['role_id', 'permission_id'])
      .ignore();
  }
};

exports.down = async function (knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS history_edges;
    DROP TABLE IF EXISTS history_nodes;
    DROP TABLE IF EXISTS history_event_inputs;
    DROP TABLE IF EXISTS history_current_values;
    DROP TABLE IF EXISTS history_field_changes;
    DROP TABLE IF EXISTS history_event_entities;
    DROP TABLE IF EXISTS history_event_actors;
    DROP TABLE IF EXISTS history_events;
    DROP TABLE IF EXISTS history_tracked_fields;
  `);

  const historyPermission = await knex('permissions')
    .select('id')
    .where({ name: 'history.view' })
    .first();
  if (historyPermission) {
    await knex('role_permissions').where({ permission_id: historyPermission.id }).del();
    await knex('permissions').where({ id: historyPermission.id }).del();
  }
};
