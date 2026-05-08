const trackedFields = [
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
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function () {
  // Intentionally left as a no-op: this migration repairs production metadata
  // that may also have been inserted by the original history migration.
};
