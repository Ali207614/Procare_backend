exports.up = async function (knex) {
  await knex.raw(`
    DO $$
    DECLARE item record;
    BEGIN
      FOR item IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'repair-order-status-transitions'
          AND nsp.nspname = current_schema()
          AND con.contype = 'u'
          AND pg_get_constraintdef(con.oid) = 'UNIQUE (from_status_id, to_status_id)'
      LOOP
        EXECUTE format(
          'ALTER TABLE %I.%I DROP CONSTRAINT %I',
          current_schema(),
          'repair-order-status-transitions',
          item.conname
        );
      END LOOP;

      FOR item IN
        SELECT idx.relname AS index_name
        FROM pg_index ix
        JOIN pg_class idx ON idx.oid = ix.indexrelid
        JOIN pg_class tbl ON tbl.oid = ix.indrelid
        JOIN pg_namespace nsp ON nsp.oid = tbl.relnamespace
        WHERE tbl.relname = 'repair-order-status-transitions'
          AND nsp.nspname = current_schema()
          AND ix.indisunique
          AND NOT ix.indisprimary
          AND ix.indpred IS NULL
          AND (
            SELECT array_agg(att.attname::text ORDER BY key_col.ordinality)
            FROM unnest(ix.indkey) WITH ORDINALITY AS key_col(attnum, ordinality)
            JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = key_col.attnum
          ) = ARRAY['from_status_id', 'to_status_id']
      LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', current_schema(), item.index_name);
      END LOOP;
    END $$;
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS repair_order_status_transitions_legacy_unique_idx
    ON "repair-order-status-transitions" (from_status_id, to_status_id)
    WHERE role_id IS NULL
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS repair_order_status_transitions_role_unique_idx
    ON "repair-order-status-transitions" (role_id, from_status_id, to_status_id)
    WHERE role_id IS NOT NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS repair_order_status_transitions_role_unique_idx');
  await knex.raw('DROP INDEX IF EXISTS repair_order_status_transitions_legacy_unique_idx');

  await knex.raw(`
    ALTER TABLE "repair-order-status-transitions"
    ADD CONSTRAINT "repair_order_status_transitions_from_status_id_to_status_id_uni"
    UNIQUE (from_status_id, to_status_id)
  `);
};
