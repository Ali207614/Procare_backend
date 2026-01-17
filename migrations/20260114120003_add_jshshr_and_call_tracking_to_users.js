exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('jshshr', 14).nullable().unique().comment('JSHSHR (PINFL) - Personal Identification Number');
    table.integer('call_count').defaultTo(0).comment('Number of calls made to this lead');
    table.timestamp('last_call_at').nullable().comment('Timestamp of the last call made');
    table.text('call_notes').nullable().comment('Notes from calls for future IP telephony integration');

    table.index('jshshr');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex('jshshr');
    table.dropColumn('jshshr');
    table.dropColumn('call_count');
    table.dropColumn('last_call_at');
    table.dropColumn('call_notes');
  });
};