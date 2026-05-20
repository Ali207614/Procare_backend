exports.up = async function (knex) {
  const hasWarrantyPeriod = await knex.schema.hasColumn('problem_categories', 'warranty_period');
  if (!hasWarrantyPeriod) {
    await knex.schema.alterTable('problem_categories', (table) => {
      table.integer('warranty_period').notNullable().defaultTo(0);
    });
  }

  const hasHistoryTable = await knex.schema.hasTable('history_tracked_fields');
  if (hasHistoryTable) {
    await knex('history_tracked_fields')
      .insert({
        entity_table: 'problem_categories',
        field_path: 'warranty_period',
        value_type: 'integer',
        is_active: true,
        is_sensitive: false,
        track_current_value: true,
        capture_old_value: true,
        capture_new_value: true,
        redaction_strategy: 'none',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .onConflict(['entity_table', 'field_path'])
      .merge({
        value_type: knex.raw('excluded.value_type'),
        is_active: knex.raw('excluded.is_active'),
        is_sensitive: knex.raw('excluded.is_sensitive'),
        track_current_value: knex.raw('excluded.track_current_value'),
        capture_old_value: knex.raw('excluded.capture_old_value'),
        capture_new_value: knex.raw('excluded.capture_new_value'),
        redaction_strategy: knex.raw('excluded.redaction_strategy'),
        updated_at: knex.fn.now(),
      });
  }
};

exports.down = async function (knex) {
  const hasHistoryTable = await knex.schema.hasTable('history_tracked_fields');
  if (hasHistoryTable) {
    await knex('history_tracked_fields')
      .where({ entity_table: 'problem_categories', field_path: 'warranty_period' })
      .delete();
  }

  const hasWarrantyPeriod = await knex.schema.hasColumn('problem_categories', 'warranty_period');
  if (hasWarrantyPeriod) {
    await knex.schema.alterTable('problem_categories', (table) => {
      table.dropColumn('warranty_period');
    });
  }
};
