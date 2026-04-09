exports.seed = async function (knex) {
  const rejectCauses = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: 'Narxi to\'g\'ri kelmadi',
      description: 'Narxi qimmatlik qilgan',
      sort: 1,
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: 'Vaqti bo\'lmadi',
      description: 'Do\'konga kelishga vaqti bo\'lmadi',
      sort: 2,
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      name: 'Adressi viloyat',
      description: 'Adressi viloyat',
      sort: 3,
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      name: 'Ma\'lumot oldi',
      description: 'Mijozda aniq maqsad yo\'q. Shunchaki qiziqib ko\'rdi',
      sort: 4,
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000005",
      name: 'Zapchast yo\'q',
      description: 'Mijozga kerakli telefon qismlari yo\'q',
      sort: 5,
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000006",
      name: 'iCloud so\'radi',
      description: 'Mijozga iCloud bilan bog\'liq xizmat kerak ekan',
      sort: 6,
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ];

  const existingRejectCauses = await knex('repair_order_reject_causes')
    .select('id', 'name');

  const existingIds = new Set(existingRejectCauses.map((cause) => cause.id));
  const existingNames = new Set(existingRejectCauses.map((cause) => cause.name));

  const missingRejectCauses = rejectCauses.filter(
    (cause) => !existingIds.has(cause.id) && !existingNames.has(cause.name),
  );

  if (missingRejectCauses.length === 0) {
    return;
  }

  // This seed can run against an existing database where repair_orders
  // already reference reject causes by id, and it only inserts rows
  // that are not already present.
  await knex('repair_order_reject_causes').insert(missingRejectCauses);
};
