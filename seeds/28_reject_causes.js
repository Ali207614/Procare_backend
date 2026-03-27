exports.seed = async function (knex) {
  const rejectCauses = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: 'Narxi to\'g\'ri kelmadi',
      description: 'Narxi qimmatlik qilgan',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: 'Vaqti bo\'lmadi',
      description: 'Do\'konga kelishga vaqti bo\'lmadi',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      name: 'Adressi viloyat',
      description: 'Adressi viloyat',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ];

  // This seed can run against an existing database where repair_orders
  // already reference these rows via reject_cause_id.
  await knex('repair_order_reject_causes')
    .insert(rejectCauses)
    .onConflict('id')
    .merge(['name', 'description', 'updated_at']);
};
