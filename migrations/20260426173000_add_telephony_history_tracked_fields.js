const trackedFields = [
  {
    entity_table: 'phone_calls',
    field_path: 'uuid',
    value_type: 'string',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'caller',
    value_type: 'phone',
    is_sensitive: true,
    normalizer_key: 'uz_phone_e164',
    redaction_strategy: 'mask',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'callee',
    value_type: 'phone',
    is_sensitive: true,
    normalizer_key: 'uz_phone_e164',
    redaction_strategy: 'mask',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'direction',
    value_type: 'enum',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'event',
    value_type: 'enum',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'call_duration',
    value_type: 'integer',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'dialog_duration',
    value_type: 'integer',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'hangup_cause',
    value_type: 'string',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'download_url',
    value_type: 'url',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'user_id',
    value_type: 'reference',
    ref_table: 'users',
  },
  {
    entity_table: 'phone_calls',
    field_path: 'repair_order_id',
    value_type: 'reference',
    ref_table: 'repair_orders',
  },
  {
    entity_table: 'repair_orders',
    field_path: 'call_count',
    value_type: 'integer',
  },
  {
    entity_table: 'repair_orders',
    field_path: 'missed_calls',
    value_type: 'integer',
  },
  {
    entity_table: 'repair_orders',
    field_path: 'customer_no_answer_count',
    value_type: 'integer',
  },
  {
    entity_table: 'repair_orders',
    field_path: 'last_customer_no_answer_at',
    value_type: 'timestamp',
  },
  {
    entity_table: 'repair_orders',
    field_path: 'customer_no_answer_due_at',
    value_type: 'timestamp',
  },
];

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
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
};

/**
 * @returns {Promise<void>}
 */
exports.down = async function () {
  // Keep metadata in place. These rows are harmless and may be depended on by
  // already-written history records.
};
