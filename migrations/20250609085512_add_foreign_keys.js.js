exports.up = async function (knex) {
    await knex.schema.alterTable('admins', function (table) {
        table.uuid('created_by').nullable();
        table.foreign('created_by').references('admins.id').onDelete('SET NULL');
    });
};


exports.down = async function (knex) {
    await knex.schema.alterTable('admins', table => {
        table.dropColumn('created_by');
    });
};
