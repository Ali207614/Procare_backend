exports.up = function (knex) {
  return knex.schema.alterTable('repair_order_rental_phones', (table) => {
    table.string('imei', 50).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('repair_order_rental_phones', (table) => {
    table.dropColumn('imei');
  });
};
