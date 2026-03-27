const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('repair_order_reject_causes').truncate();

  const rejectCauses = [
    {
      id: uuidv4(),
      name: 'Narxi to\'g\'ri kelmadi',
      description: 'Narxi qimmatlik qilgan',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      name: 'Vaqti bo\'lmadi',
      description: 'Do\'konga kelishga vaqti bo\'lmadi',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      name: 'Adressi viloyat',
      description: 'Adressi viloyat',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ];

  await knex('repair_order_reject_causes').insert(rejectCauses);
};
