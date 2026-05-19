/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Ensure only one document is active open if there are multiple.
  const activeOpenDocs = await knex('warranty_documents')
    .where({ is_active: true, status: 'Open' })
    .orderBy('created_at', 'desc');

  if (activeOpenDocs.length > 1) {
    const idsToDeactivate = activeOpenDocs.slice(1).map((doc) => doc.id);
    await knex('warranty_documents')
      .whereIn('id', idsToDeactivate)
      .update({ is_active: false, updated_at: knex.fn.now() });
  }

  // Check if the partial index already exists
  const { rows: indexes } = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'warranty_documents'
      AND indexname = 'warranty_documents_single_active_open_idx';
  `);

  if (indexes.length === 0) {
    await knex.raw(`
      CREATE UNIQUE INDEX warranty_documents_single_active_open_idx
      ON warranty_documents (is_active)
      WHERE is_active = true AND status = 'Open'
    `);
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS warranty_documents_single_active_open_idx
  `);
};
