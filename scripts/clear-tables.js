const knexConfig = require('../knexfile.js');

const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

const DEFAULT_CUTOFF = '2026-04-08';

const DATE_FILTERED_TABLES = [
  'repair-order-status-transitions',
  'repair_order_attachments',
  'phone_calls',
  'repair_order_assign_admins',
  'repair_order_change_histories',
  'repair_order_comments',
  'repair_order_deliveries',
  'repair_order_parts',
  'repair_order_payments',
  'repair_order_pickups',
  'service_forms',
  'repair_order_rental_phones',
  'repair_order_initial_problems',
  'repair_order_final_problems',
];

const REPAIR_ORDER_CHILD_TABLES = [
  { table: 'repair_order_attachments', foreignKey: 'repair_order_id' },
  { table: 'phone_calls', foreignKey: 'repair_order_id' },
  { table: 'repair_order_assign_admins', foreignKey: 'repair_order_id' },
  { table: 'repair_order_change_histories', foreignKey: 'repair_order_id' },
  { table: 'repair_order_comments', foreignKey: 'repair_order_id' },
  { table: 'repair_order_deliveries', foreignKey: 'repair_order_id' },
  { table: 'repair_order_parts', foreignKey: 'repair_order_id' },
  { table: 'repair_order_payments', foreignKey: 'repair_order_id' },
  { table: 'repair_order_pickups', foreignKey: 'repair_order_id' },
  { table: 'service_forms', foreignKey: 'repair_order_id' },
  { table: 'repair_order_rental_phones', foreignKey: 'repair_order_id' },
  { table: 'repair_order_initial_problems', foreignKey: 'repair_order_id' },
  { table: 'repair_order_final_problems', foreignKey: 'repair_order_id' },
];

const USER_CHILD_TABLES = [
  { table: 'repair_orders', foreignKey: 'user_id' },
  { table: 'phone_calls', foreignKey: 'user_id' },
  { table: 'user_offer_acceptances', foreignKey: 'user_id' },
  { table: 'campaign_recipient', foreignKey: 'user_id' },
  { table: 'user_phone_category_assignment', foreignKey: 'user_id' },
];

function getArgValue(flagName) {
  const exactArg = process.argv.find((arg) => arg.startsWith(`${flagName}=`));
  if (exactArg) {
    return exactArg.slice(flagName.length + 1);
  }

  const flagIndex = process.argv.indexOf(flagName);
  if (flagIndex >= 0) {
    return process.argv[flagIndex + 1];
  }

  return undefined;
}

function parseCutoffDate(input) {
  const normalized = (input || DEFAULT_CUTOFF).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(
      `Invalid cutoff date "${normalized}". Use YYYY-MM-DD format, for example ${DEFAULT_CUTOFF}.`,
    );
  }

  return normalized;
}

function shouldAutoConfirm() {
  return (
    process.argv.includes('--force') ||
    process.argv.includes('--yes') ||
    process.env.DB_CLEAR_AUTO_CONFIRM === 'true'
  );
}

function isDryRun() {
  return process.argv.includes('--dry-run');
}

async function countRowsBefore(trx, tableName, cutoffDate) {
  const result = await trx(tableName).where('created_at', '<', cutoffDate).count('* as count').first();
  return Number(result?.count || 0);
}

async function deleteRowsBefore(trx, tableName, cutoffDate, dryRun) {
  const count = await countRowsBefore(trx, tableName, cutoffDate);

  if (count === 0) {
    console.log(`- ${tableName}: 0 rows matched`);
    return 0;
  }

  if (dryRun) {
    console.log(`- ${tableName}: ${count} rows would be deleted`);
    return count;
  }

  const deleted = await trx(tableName).where('created_at', '<', cutoffDate).del();
  console.log(`- ${tableName}: deleted ${deleted} rows`);
  return deleted;
}

function buildParentCleanupQuery(trx, parentTable, parentAlias, childTables, cutoffDate) {
  const query = trx(`${parentTable} as ${parentAlias}`)
    .select(`${parentAlias}.id`)
    .where(`${parentAlias}.created_at`, '<', cutoffDate);

  for (const child of childTables) {
    query.whereNotExists(
      trx(child.table)
        .select(1)
        .whereNotNull(`${child.table}.${child.foreignKey}`)
        .where(`${child.table}.${child.foreignKey}`, trx.ref(`${parentAlias}.id`)),
    );
  }

  return query;
}

async function deleteParentRows(trx, { label, tableName, alias, childTables, cutoffDate, dryRun }) {
  const idsToDelete = await buildParentCleanupQuery(
    trx,
    tableName,
    alias,
    childTables,
    cutoffDate,
  );

  if (idsToDelete.length === 0) {
    console.log(`- ${label}: 0 rows matched`);
    return 0;
  }

  if (dryRun) {
    console.log(`- ${label}: ${idsToDelete.length} rows would be deleted`);
    return idsToDelete.length;
  }

  const deleted = await trx(tableName)
    .whereIn(
      'id',
      idsToDelete.map((row) => row.id),
    )
    .del();

  console.log(`- ${label}: deleted ${deleted} rows`);
  return deleted;
}

async function run() {
  const cutoffDate = parseCutoffDate(getArgValue('--before') || process.env.DB_CLEAR_BEFORE);
  const autoConfirm = shouldAutoConfirm();
  const dryRun = isDryRun();

  if (!autoConfirm) {
    console.log('WARNING: This script performs date-filtered cleanup on selected tables.');
    console.log(`Only rows with created_at before ${cutoffDate} will be eligible for deletion.`);
    console.log('To proceed, run one of the following commands:');
    console.log(`  npm run db:clear -- --yes --before=${cutoffDate}`);
    console.log(`  npm run db:clear -- --dry-run --yes --before=${cutoffDate}`);
    process.exit(0);
  }

  console.log(`${dryRun ? 'Previewing' : 'Running'} date-filtered cleanup...`);
  console.log(`Cutoff date: ${cutoffDate} (rows created before this date are eligible)`);

  try {
    await knex.transaction(async (trx) => {
      let totalAffectedRows = 0;

      for (const tableName of DATE_FILTERED_TABLES) {
        totalAffectedRows += await deleteRowsBefore(trx, tableName, cutoffDate, dryRun);
      }

      totalAffectedRows += await deleteParentRows(trx, {
        label: 'repair_orders',
        tableName: 'repair_orders',
        alias: 'ro',
        childTables: REPAIR_ORDER_CHILD_TABLES,
        cutoffDate,
        dryRun,
      });

      totalAffectedRows += await deleteParentRows(trx, {
        label: 'users',
        tableName: 'users',
        alias: 'u',
        childTables: USER_CHILD_TABLES,
        cutoffDate,
        dryRun,
      });

      console.log(
        `${dryRun ? 'Preview complete' : 'Cleanup complete'}: ${totalAffectedRows} rows ${
          dryRun ? 'would be affected' : 'affected'
        }.`,
      );
    });
  } catch (error) {
    console.error('Error clearing tables safely:', error);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

run();
