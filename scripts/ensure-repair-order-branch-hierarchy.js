const knexConfig = require('../knexfile.js');
const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

const MOTHER_BRANCH_ID = '00000000-0000-4000-8000-000000000000';
const SYSTEM_ADMIN_ID = '00000000-0000-4000-8000-000000000000';

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function statusKey(status) {
  if (status.type) return `type:${status.type}`;
  return [
    'name',
    normalizeName(status.name_uz),
    normalizeName(status.name_ru),
    normalizeName(status.name_en),
  ].join(':');
}

async function ensureSchema(trx) {
  const hasBranches = await trx.schema.hasTable('branches');
  const hasStatuses = await trx.schema.hasTable('repair_order_statuses');
  const hasOrders = await trx.schema.hasTable('repair_orders');
  const hasPermissions = await trx.schema.hasTable('repair_order_status_permissions');

  if (!hasBranches || !hasStatuses || !hasOrders || !hasPermissions) {
    throw new Error('Required tables are missing. Run migrations before this startup reconcile.');
  }

  const hasParentBranchId = await trx.schema.hasColumn('branches', 'parent_branch_id');
  if (!hasParentBranchId) {
    await trx.schema.alterTable('branches', (table) => {
      table
        .uuid('parent_branch_id')
        .nullable()
        .references('id')
        .inTable('branches')
        .onDelete('RESTRICT');
    });
  }
}

async function ensureMotherBranch(trx) {
  const systemAdmin = await trx('admins').where({ id: SYSTEM_ADMIN_ID }).first('id');
  const now = new Date();

  await trx('branches')
    .insert({
      id: MOTHER_BRANCH_ID,
      name_uz: 'Texnik filial',
      name_ru: 'Технический филиал',
      name_en: 'Technical Branch',
      address_uz: 'Aniqlanmagan',
      address_ru: 'Не указано',
      address_en: 'Unknown',
      bg_color: '#cccccc',
      color: '#000000',
      status: 'Open',
      is_active: true,
      is_protected: true,
      parent_branch_id: null,
      created_by: systemAdmin ? SYSTEM_ADMIN_ID : null,
      sort: 1,
      created_at: now,
      updated_at: now,
    })
    .onConflict('id')
    .merge({
      status: 'Open',
      is_active: true,
      is_protected: true,
      parent_branch_id: null,
      updated_at: now,
    });

  await trx('branches')
    .whereNot({ id: MOTHER_BRANCH_ID })
    .where({ status: 'Open' })
    .update({ parent_branch_id: MOTHER_BRANCH_ID, updated_at: now });
}

async function ensureMotherStatusesExist(trx) {
  const statusCount = await trx('repair_order_statuses')
    .count('* as count')
    .first();

  if (Number(statusCount?.count || 0) === 0) {
    console.log('No repair order statuses found; skipping canonical status reconcile until statuses are seeded.');
    return false;
  }

  const motherStatusCount = await trx('repair_order_statuses')
    .where({ branch_id: MOTHER_BRANCH_ID, status: 'Open', is_active: true })
    .count('* as count')
    .first();

  if (Number(motherStatusCount?.count || 0) === 0) {
    throw new Error(
      'Mother Branch has no active repair order statuses. Create or migrate protected-branch statuses before startup reconcile.',
    );
  }

  return true;
}

async function buildStatusMap(trx) {
  const motherStatuses = await trx('repair_order_statuses')
    .where({ branch_id: MOTHER_BRANCH_ID, status: 'Open' })
    .orderBy('sort', 'asc');
  const motherByKey = new Map(motherStatuses.map((status) => [statusKey(status), status]));
  const childStatuses = await trx('repair_order_statuses')
    .whereNot({ branch_id: MOTHER_BRANCH_ID })
    .where({ status: 'Open' })
    .orderBy(['branch_id', 'sort']);
  const mappings = [];

  for (const childStatus of childStatuses) {
    const motherStatus = motherByKey.get(statusKey(childStatus));
    if (!motherStatus) {
      console.log(
        `Skipped child status ${childStatus.id}; no matching Mother status by type/name. Mother statuses were not modified.`,
      );
      continue;
    }

    mappings.push({
      child_status_id: childStatus.id,
      mother_status_id: motherStatus.id,
    });
  }

  return mappings;
}

async function ensureChildKanbanStatusPermissions(trx) {
  await trx.raw(`
    INSERT INTO repair_order_status_permissions (
      branch_id,
      status_id,
      role_id,
      can_add,
      can_view,
      can_update,
      can_delete,
      can_payment_add,
      can_payment_cancel,
      can_assign_admin,
      can_notification,
      can_notification_bot,
      can_change_active,
      can_change_status,
      can_view_initial_problems,
      can_change_initial_problems,
      can_view_final_problems,
      can_change_final_problems,
      can_comment,
      can_pickup_manage,
      can_delivery_manage,
      can_view_payments,
      can_manage_rental_phone,
      can_view_history,
      can_user_manage,
      can_create_user,
      cannot_continue_without_imei,
      cannot_continue_without_reject_cause,
      cannot_continue_without_agreed_date,
      cannot_continue_without_service_form,
      created_at,
      updated_at
    )
    SELECT
      branch_roles.branch_id,
      mother_statuses.id,
      branch_roles.role_id,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      NOW(),
      NOW()
    FROM (
      SELECT DISTINCT p.branch_id, p.role_id
      FROM repair_order_status_permissions p
      JOIN branches b ON b.id = p.branch_id
      WHERE b.status = 'Open'
        AND b.is_active = true
    ) branch_roles
    CROSS JOIN (
      SELECT id
      FROM repair_order_statuses
      WHERE branch_id = '${MOTHER_BRANCH_ID}'::uuid
        AND status = 'Open'
        AND is_active = true
    ) mother_statuses
    ON CONFLICT (branch_id, status_id, role_id) DO NOTHING;
  `);
}

async function applyStatusMap(trx, mappings) {
  if (!mappings.length) return;

  await trx.raw('CREATE TEMP TABLE startup_status_mother_map (child_status_id uuid PRIMARY KEY, mother_status_id uuid NOT NULL) ON COMMIT DROP;');
  await trx.batchInsert('startup_status_mother_map', mappings, 500);

  await trx.raw(`
    UPDATE repair_orders ro
    SET status_id = sm.mother_status_id,
        updated_at = NOW()
    FROM startup_status_mother_map sm
    WHERE ro.status_id = sm.child_status_id;
  `);

  await trx.raw(`
    INSERT INTO "repair-order-status-transitions" (
      from_status_id,
      to_status_id,
      role_id,
      created_at,
      updated_at
    )
    SELECT DISTINCT
      COALESCE(from_map.mother_status_id, transition.from_status_id),
      COALESCE(to_map.mother_status_id, transition.to_status_id),
      transition.role_id,
      NOW(),
      NOW()
    FROM "repair-order-status-transitions" transition
    LEFT JOIN startup_status_mother_map from_map ON from_map.child_status_id = transition.from_status_id
    LEFT JOIN startup_status_mother_map to_map ON to_map.child_status_id = transition.to_status_id
    WHERE (from_map.child_status_id IS NOT NULL OR to_map.child_status_id IS NOT NULL)
      AND COALESCE(from_map.mother_status_id, transition.from_status_id)
          <> COALESCE(to_map.mother_status_id, transition.to_status_id)
      AND NOT EXISTS (
        SELECT 1
        FROM "repair-order-status-transitions" existing
        WHERE existing.from_status_id = COALESCE(from_map.mother_status_id, transition.from_status_id)
          AND existing.to_status_id = COALESCE(to_map.mother_status_id, transition.to_status_id)
          AND (
            existing.role_id = transition.role_id
            OR (existing.role_id IS NULL AND transition.role_id IS NULL)
          )
      );
  `);

  await trx.raw(`
    INSERT INTO repair_order_status_permissions (
      branch_id,
      status_id,
      role_id,
      can_add,
      can_view,
      can_update,
      can_delete,
      can_payment_add,
      can_payment_cancel,
      can_assign_admin,
      can_notification,
      can_notification_bot,
      can_change_active,
      can_change_status,
      can_view_initial_problems,
      can_change_initial_problems,
      can_view_final_problems,
      can_change_final_problems,
      can_comment,
      can_pickup_manage,
      can_delivery_manage,
      can_view_payments,
      can_manage_rental_phone,
      can_view_history,
      can_user_manage,
      can_create_user,
      cannot_continue_without_imei,
      cannot_continue_without_reject_cause,
      cannot_continue_without_agreed_date,
      cannot_continue_without_service_form,
      created_at,
      updated_at
    )
    SELECT
      p.branch_id,
      sm.mother_status_id,
      p.role_id,
      bool_or(p.can_add),
      bool_or(p.can_view),
      bool_or(p.can_update),
      bool_or(p.can_delete),
      bool_or(p.can_payment_add),
      bool_or(p.can_payment_cancel),
      bool_or(p.can_assign_admin),
      bool_or(p.can_notification),
      bool_or(p.can_notification_bot),
      bool_or(p.can_change_active),
      bool_or(p.can_change_status),
      bool_or(p.can_view_initial_problems),
      bool_or(p.can_change_initial_problems),
      bool_or(p.can_view_final_problems),
      bool_or(p.can_change_final_problems),
      bool_or(p.can_comment),
      bool_or(p.can_pickup_manage),
      bool_or(p.can_delivery_manage),
      bool_or(p.can_view_payments),
      bool_or(p.can_manage_rental_phone),
      bool_or(p.can_view_history),
      bool_or(p.can_user_manage),
      bool_or(p.can_create_user),
      bool_or(p.cannot_continue_without_imei),
      bool_or(COALESCE(p.cannot_continue_without_reject_cause, false)),
      bool_or(COALESCE(p.cannot_continue_without_agreed_date, false)),
      bool_or(COALESCE(p.cannot_continue_without_service_form, false)),
      MIN(p.created_at),
      NOW()
    FROM repair_order_status_permissions p
    JOIN startup_status_mother_map sm ON sm.child_status_id = p.status_id
    GROUP BY p.branch_id, sm.mother_status_id, p.role_id
    ON CONFLICT (branch_id, status_id, role_id) DO UPDATE SET
      can_add = repair_order_status_permissions.can_add OR EXCLUDED.can_add,
      can_view = repair_order_status_permissions.can_view OR EXCLUDED.can_view,
      can_update = repair_order_status_permissions.can_update OR EXCLUDED.can_update,
      can_delete = repair_order_status_permissions.can_delete OR EXCLUDED.can_delete,
      can_payment_add = repair_order_status_permissions.can_payment_add OR EXCLUDED.can_payment_add,
      can_payment_cancel = repair_order_status_permissions.can_payment_cancel OR EXCLUDED.can_payment_cancel,
      can_assign_admin = repair_order_status_permissions.can_assign_admin OR EXCLUDED.can_assign_admin,
      can_notification = repair_order_status_permissions.can_notification OR EXCLUDED.can_notification,
      can_notification_bot = repair_order_status_permissions.can_notification_bot OR EXCLUDED.can_notification_bot,
      can_change_active = repair_order_status_permissions.can_change_active OR EXCLUDED.can_change_active,
      can_change_status = repair_order_status_permissions.can_change_status OR EXCLUDED.can_change_status,
      can_view_initial_problems = repair_order_status_permissions.can_view_initial_problems OR EXCLUDED.can_view_initial_problems,
      can_change_initial_problems = repair_order_status_permissions.can_change_initial_problems OR EXCLUDED.can_change_initial_problems,
      can_view_final_problems = repair_order_status_permissions.can_view_final_problems OR EXCLUDED.can_view_final_problems,
      can_change_final_problems = repair_order_status_permissions.can_change_final_problems OR EXCLUDED.can_change_final_problems,
      can_comment = repair_order_status_permissions.can_comment OR EXCLUDED.can_comment,
      can_pickup_manage = repair_order_status_permissions.can_pickup_manage OR EXCLUDED.can_pickup_manage,
      can_delivery_manage = repair_order_status_permissions.can_delivery_manage OR EXCLUDED.can_delivery_manage,
      can_view_payments = repair_order_status_permissions.can_view_payments OR EXCLUDED.can_view_payments,
      can_manage_rental_phone = repair_order_status_permissions.can_manage_rental_phone OR EXCLUDED.can_manage_rental_phone,
      can_view_history = repair_order_status_permissions.can_view_history OR EXCLUDED.can_view_history,
      can_user_manage = repair_order_status_permissions.can_user_manage OR EXCLUDED.can_user_manage,
      can_create_user = repair_order_status_permissions.can_create_user OR EXCLUDED.can_create_user,
      cannot_continue_without_imei = repair_order_status_permissions.cannot_continue_without_imei OR EXCLUDED.cannot_continue_without_imei,
      cannot_continue_without_reject_cause = repair_order_status_permissions.cannot_continue_without_reject_cause OR EXCLUDED.cannot_continue_without_reject_cause,
      cannot_continue_without_agreed_date = repair_order_status_permissions.cannot_continue_without_agreed_date OR EXCLUDED.cannot_continue_without_agreed_date,
      cannot_continue_without_service_form = repair_order_status_permissions.cannot_continue_without_service_form OR EXCLUDED.cannot_continue_without_service_form,
      updated_at = NOW();
  `);

  await trx.raw(`
    DELETE FROM repair_order_status_permissions p
    USING startup_status_mother_map sm
    WHERE p.status_id = sm.child_status_id;
  `);

  await trx.raw(`
    UPDATE repair_order_statuses s
    SET status = 'Deleted',
        is_active = false,
        updated_at = NOW()
    FROM startup_status_mother_map sm
    WHERE s.id = sm.child_status_id
      AND NOT EXISTS (
        SELECT 1
        FROM repair_orders ro
        WHERE ro.status_id = s.id
      );
  `);
}

async function main() {
  console.log('Reconciling repair order branch hierarchy and canonical statuses...');
  try {
    await knex.transaction(async (trx) => {
      await ensureSchema(trx);
      await ensureMotherBranch(trx);
      const hasMotherStatuses = await ensureMotherStatusesExist(trx);
      if (!hasMotherStatuses) {
        return;
      }

      const mappings = await buildStatusMap(trx);
      await applyStatusMap(trx, mappings);
      await ensureChildKanbanStatusPermissions(trx);
      console.log(`Mapped ${mappings.length} child status rows to Mother statuses.`);
    });
    console.log('Repair order branch hierarchy and canonical statuses are reconciled.');
  } catch (error) {
    console.error('Failed to reconcile repair order branch hierarchy:', error);
    process.exitCode = 1;
  } finally {
    await knex.destroy();
  }
}

main();
