exports.up = async function (knex) {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_order_comments_fast_read_idx
    ON repair_order_comments (
      repair_order_id,
      status,
      comment_type,
      created_at DESC,
      id DESC
    )
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS phone_calls_repair_order_audio_idx
    ON phone_calls (
      repair_order_id,
      created_at DESC,
      id DESC
    )
    WHERE download_url IS NOT NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS phone_calls_repair_order_audio_idx');
  await knex.raw('DROP INDEX IF EXISTS repair_order_comments_fast_read_idx');
};
