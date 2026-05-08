exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE repair_order_comments
    ALTER COLUMN "text" TYPE text
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE repair_order_comments
    ALTER COLUMN "text" TYPE varchar(255)
    USING LEFT("text", 255)
  `);
};
