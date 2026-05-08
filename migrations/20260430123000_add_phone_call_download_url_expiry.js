exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('phone_calls', 'download_url_expires_at');
  if (!hasColumn) {
    await knex.schema.alterTable('phone_calls', (table) => {
      table.timestamp('download_url_expires_at').nullable();
    });
  }

  await knex.raw(`
    UPDATE phone_calls
    SET download_url_expires_at = COALESCE(updated_at, created_at) + INTERVAL '29 minutes'
    WHERE download_url IS NOT NULL
      AND download_url_expires_at IS NULL
  `);
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('phone_calls', 'download_url_expires_at');
  if (hasColumn) {
    await knex.schema.alterTable('phone_calls', (table) => {
      table.dropColumn('download_url_expires_at');
    });
  }
};
