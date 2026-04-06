const knexConfig = require('../knexfile.js');
const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

const TABLES_TO_CLEAR = [
  'repair_order_status_transitions',
  'phone_calls',
  'repair_order_assign_admins',
  'repair_order_attachments',
  'repair_order_change_histories',
  'repair_order_comments',
  'repair_order_deliveries',
  'repair_order_final_problems',
  'repair_order_initial_problems',
  'repair_order_parts',
  'repair_order_payments',
  'repair_order_pickups',
  'repair_order_rental_phones',
  'repair_orders',
  'service_forms',
  'users',
];

async function run() {
  const force = process.argv.includes('--force');

  if (!force) {
    console.log('⚠️  WARNING: This script will truncate the following tables:');
    console.log(TABLES_TO_CLEAR.map((t) => ` - ${t}`).join('\n'));
    console.log('\nThis action is IRREVERSIBLE and will delete all data in these tables.');
    console.log('To proceed, run the command with the --force flag:');
    console.log('  npm run db:clear -- --force');
    process.exit(0);
  }

  console.log('🚀 Clearing tables...');
  try {
    // We use a transaction to ensure all or nothing
    await knex.transaction(async (trx) => {
      // Disable triggers to speed up and avoid foreign key issues during individual truncates if needed,
      // but TRUNCATE CASCADE is generally better and safer for Postgres.
      
      // PostgreSQL specific TRUNCATE with CASCADE and IDENTITY RESTART
      const tablesList = TABLES_TO_CLEAR.join(', ');
      await trx.raw(`TRUNCATE TABLE ${tablesList} RESTART IDENTITY CASCADE`);
      
      console.log('✅ All specified tables have been cleared and identities reset.');
    });
  } catch (error) {
    console.error('❌ Error clearing tables:', error);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

run();
