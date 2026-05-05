exports.config = { transaction: false };

exports.up = async function (knex) {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS repair_orders_viewable_status_sort_idx
    ON repair_orders (branch_id, status_id, sort, id)
    WHERE status = 'Open';
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS repair_orders_search_number_text_idx
    ON repair_orders ((number_id::text) text_pattern_ops);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS repair_orders_viewable_user_search_idx
    ON repair_orders (user_id, branch_id, status_id)
    WHERE status = 'Open' AND user_id IS NOT NULL;
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS repair_orders_viewable_phone_category_search_idx
    ON repair_orders (phone_category_id, branch_id, status_id)
    WHERE status = 'Open' AND phone_category_id IS NOT NULL;
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS repair_orders_search_phone_digits_trgm_idx
    ON repair_orders USING gin (
      (regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g')) gin_trgm_ops
    );
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS repair_orders_search_name_trgm_idx
    ON repair_orders USING gin ((LOWER(COALESCE(name, ''))) gin_trgm_ops);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS users_search_phone1_digits_trgm_idx
    ON users USING gin (
      (regexp_replace(COALESCE(phone_number1, ''), '\\D', '', 'g')) gin_trgm_ops
    );
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS users_search_phone2_digits_trgm_idx
    ON users USING gin (
      (regexp_replace(COALESCE(phone_number2, ''), '\\D', '', 'g')) gin_trgm_ops
    );
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS users_search_full_name_trgm_idx
    ON users USING gin (
      (LOWER(BTRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')))) gin_trgm_ops
    );
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS phone_categories_search_names_trgm_idx
    ON phone_categories USING gin (
      (
        LOWER(
          BTRIM(COALESCE(name_uz, '') || ' ' || COALESCE(name_ru, '') || ' ' || COALESCE(name_en, ''))
        )
      ) gin_trgm_ops
    );
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS phone_categories_search_names_trgm_idx;`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS users_search_full_name_trgm_idx;`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS users_search_phone2_digits_trgm_idx;`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS users_search_phone1_digits_trgm_idx;`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS repair_orders_search_name_trgm_idx;`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS repair_orders_search_phone_digits_trgm_idx;`);
  await knex.raw(
    `DROP INDEX CONCURRENTLY IF EXISTS repair_orders_viewable_phone_category_search_idx;`,
  );
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS repair_orders_viewable_user_search_idx;`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS repair_orders_search_number_text_idx;`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS repair_orders_viewable_status_sort_idx;`);
};
