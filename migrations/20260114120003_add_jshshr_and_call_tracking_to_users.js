exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('jshshr', 14).nullable().unique().comment('JSHSHR (PINFL) - Personal Identification Number');
    table.index('jshshr');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex('jshshr');
    table.dropColumn('jshshr');
  });
};