exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE "repair_order_statuses" DROP CONSTRAINT IF EXISTS "repair_order_statuses_type_check";
    ALTER TABLE "repair_order_statuses"
      ADD CONSTRAINT "repair_order_statuses_type_check"
      CHECK (type IN ('Completed', 'Cancelled', 'Open', 'Invalid', 'Missed'));
  `);

  const hasNoAnswerCount = await knex.schema.hasColumn(
    'repair_orders',
    'customer_no_answer_count',
  );
  const hasLastNoAnswerAt = await knex.schema.hasColumn(
    'repair_orders',
    'last_customer_no_answer_at',
  );
  const hasNoAnswerDueAt = await knex.schema.hasColumn(
    'repair_orders',
    'customer_no_answer_due_at',
  );

  await knex.schema.alterTable('repair_orders', (table) => {
    if (!hasNoAnswerCount) {
      table.integer('customer_no_answer_count').notNullable().defaultTo(0);
    }

    if (!hasLastNoAnswerAt) {
      table.timestamp('last_customer_no_answer_at').nullable();
    }

    if (!hasNoAnswerDueAt) {
      table.timestamp('customer_no_answer_due_at').nullable();
    }
  });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_orders_customer_no_answer_due_idx
    ON repair_orders (customer_no_answer_due_at)
    WHERE customer_no_answer_due_at IS NOT NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS repair_orders_customer_no_answer_due_idx
  `);

  const hasNoAnswerDueAt = await knex.schema.hasColumn(
    'repair_orders',
    'customer_no_answer_due_at',
  );
  const hasLastNoAnswerAt = await knex.schema.hasColumn(
    'repair_orders',
    'last_customer_no_answer_at',
  );
  const hasNoAnswerCount = await knex.schema.hasColumn(
    'repair_orders',
    'customer_no_answer_count',
  );

  await knex.schema.alterTable('repair_orders', (table) => {
    if (hasNoAnswerDueAt) {
      table.dropColumn('customer_no_answer_due_at');
    }

    if (hasLastNoAnswerAt) {
      table.dropColumn('last_customer_no_answer_at');
    }

    if (hasNoAnswerCount) {
      table.dropColumn('customer_no_answer_count');
    }
  });

  await knex('repair_order_statuses').where({ type: 'Missed' }).update({ type: null });

  await knex.raw(`
    ALTER TABLE "repair_order_statuses" DROP CONSTRAINT IF EXISTS "repair_order_statuses_type_check";
    ALTER TABLE "repair_order_statuses"
      ADD CONSTRAINT "repair_order_statuses_type_check"
      CHECK (type IN ('Completed', 'Cancelled', 'Open', 'Invalid'));
  `);
};
