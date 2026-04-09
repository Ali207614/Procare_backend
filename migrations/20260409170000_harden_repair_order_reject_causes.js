/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
  const table = 'repair_order_reject_causes';
  const defaultRejectCauses = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: "Narxi to'g'ri kelmadi",
      description: 'Narxi qimmatlik qilgan',
      sort: 1,
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: "Vaqti bo'lmadi",
      description: "Do'konga kelishga vaqti bo'lmadi",
      sort: 2,
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Adressi viloyat',
      description: 'Adressi viloyat',
      sort: 3,
    },
    {
      id: '00000000-0000-4000-8000-000000000004',
      name: "Ma'lumot oldi",
      description: "Mijozda aniq maqsad yo'q. Shunchaki qiziqib ko'rdi",
      sort: 4,
    },
    {
      id: '00000000-0000-4000-8000-000000000005',
      name: "Zapchast yo'q",
      description: "Mijozga kerakli telefon qismlari yo'q",
      sort: 5,
    },
    {
      id: '00000000-0000-4000-8000-000000000006',
      name: "iCloud so'radi",
      description: 'Mijozga iCloud bilan bog‘liq xizmat kerak ekan',
      sort: 6,
    },
  ];

  const hasStatus = await knex.schema.hasColumn(table, 'status');
  const hasIsActive = await knex.schema.hasColumn(table, 'is_active');
  const hasSort = await knex.schema.hasColumn(table, 'sort');

  await knex.schema.alterTable(table, (t) => {
    if (!hasStatus) {
      t.string('status').notNullable().defaultTo('Open');
    }

    if (!hasIsActive) {
      t.boolean('is_active').notNullable().defaultTo(true);
    }

    if (!hasSort) {
      t.integer('sort');
    }
  });

  await knex(table).whereNull('status').update({ status: 'Open' });
  await knex(table).whereNull('is_active').update({ is_active: true });

  const rows = await knex(table).select('id').orderBy('created_at', 'asc').orderBy('id', 'asc');
  for (const [index, row] of rows.entries()) {
    await knex(table).where({ id: row.id }).update({ sort: index + 1 });
  }

  await knex.raw(`
    ALTER TABLE ${table}
    ALTER COLUMN sort SET DEFAULT 1
  `);
  await knex.raw(`
    ALTER TABLE ${table}
    ALTER COLUMN sort SET NOT NULL
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS repair_order_reject_causes_name_unique_open_idx
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX repair_order_reject_causes_name_unique_open_idx
    ON ${table} (LOWER(name))
    WHERE status = 'Open'
  `);

  for (const cause of defaultRejectCauses) {
    const existing = await knex(table)
      .where({ id: cause.id })
      .orWhereRaw('LOWER(name) = LOWER(?)', [cause.name])
      .first();

    if (!existing) {
      await knex(table).insert({
        id: cause.id,
        name: cause.name,
        description: cause.description,
        sort: cause.sort,
        is_active: true,
        status: 'Open',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function (knex) {
  const table = 'repair_order_reject_causes';

  await knex.raw(`
    DROP INDEX IF EXISTS repair_order_reject_causes_name_unique_open_idx
  `);

  const hasSort = await knex.schema.hasColumn(table, 'sort');
  const hasIsActive = await knex.schema.hasColumn(table, 'is_active');
  const hasStatus = await knex.schema.hasColumn(table, 'status');

  await knex.schema.alterTable(table, (t) => {
    if (hasSort) {
      t.dropColumn('sort');
    }

    if (hasIsActive) {
      t.dropColumn('is_active');
    }

    if (hasStatus) {
      t.dropColumn('status');
    }
  });
};
