exports.up = async function (knex) {
    await knex.schema.createTable('phone_problem_mappings', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('phone_category_id').notNullable().references('id').inTable('phone_categories').onDelete('CASCADE');
        table.uuid('problem_category_id').notNullable().references('id').inTable('problem_categories').onDelete('CASCADE');

        table.unique(['phone_category_id', 'problem_category_id']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('phone_problem_mappings');
};
