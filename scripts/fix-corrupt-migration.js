const knexConfig = require('../knexfile.js');
const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

async function run() {
  try {
    const corruptRecord = await knex('knex_migrations')
      .where({ name: '20250609085512_add_foreign_keys.js.js' })
      .first();

    if (corruptRecord) {
      console.log('🔄 Fixing corrupt migration record in production...');
      await knex('knex_migrations')
        .where({ id: corruptRecord.id })
        .update({ name: corruptRecord.name.replace('.js.js', '.js') });
      console.log('✅ Fix applied.');
    }
  } catch (error) {
    // If table doesn't exist yet, just ignore (happens on first install)
    if (error.code !== '42P01') {
      console.error('⚠️ Warning during migration fix check:', error.message);
    }
  } finally {
    await knex.destroy();
  }
}

run();
