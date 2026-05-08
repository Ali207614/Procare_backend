const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('service_forms').del();

  const repairOrders = await knex('repair_orders').limit(10);

  if (!repairOrders.length) {
    console.log('No repair orders found. Skipping service_forms seed.');
    return;
  }

  const serviceForms = [];

  for (let i = 0; i < repairOrders.length; i++) {
    // Only generate service forms for a subset of repair orders
    if (i % 2 === 0) continue; 

    serviceForms.push({
      id: uuidv4(),
      warranty_id: `WARRANTY-${1000 + i}`,
      repair_order_id: repairOrders[i].id,
      file_path: `/uploads/service_forms/service_form_${repairOrders[i].id}.pdf`,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }

  if (serviceForms.length > 0) {
    await knex('service_forms').insert(serviceForms);
  }
};
