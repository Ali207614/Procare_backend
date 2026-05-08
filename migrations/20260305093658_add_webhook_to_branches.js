
exports.up = function(knex) {
  return knex.schema.alterTable('branches', (table) => {
    table.string('webhook_auth_header').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('branches', (table) => {
    table.dropColumn('webhook_auth_header');
  });
};
