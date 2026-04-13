const knexConfig = require('../knexfile.js');
const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

function loadManagerClass() {
  try {
    return require('../dist/repair-orders/utils/repair-order-history-comment-manager')
      .RepairOrderHistoryCommentManager;
  } catch (distError) {
    try {
      require('ts-node/register/transpile-only');
      require('tsconfig-paths/register');
      return require('../src/repair-orders/utils/repair-order-history-comment-manager')
        .RepairOrderHistoryCommentManager;
    } catch (srcError) {
      console.error('❌ Failed to load history comment manager.');
      console.error('Dist error:', distError);
      console.error('Source error:', srcError);
      process.exit(1);
    }
  }
}

async function run() {
  const RepairOrderHistoryCommentManager = loadManagerClass();
  const manager = new RepairOrderHistoryCommentManager(knex, console);

  console.log('🔄 Backfilling repair order history comments...');

  try {
    const result = await manager.backfillMissingComments();
    console.log(
      `✅ Backfill complete. Processed: ${result.processed}, created: ${result.created}, skipped: ${result.skipped}`,
    );
  } catch (error) {
    console.error('❌ Failed to backfill repair order history comments:', error);
    process.exitCode = 1;
  } finally {
    await knex.destroy();
  }
}

run();
