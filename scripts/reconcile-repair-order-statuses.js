const knexConfig = require('../knexfile.js');
const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

const NO_ANSWER_REJECT_CAUSE_NAME = "Qo'ng'iroqqa javob bermadi";

const REQUIRED_STATUSES = [
  {
    type: 'Open',
    name_uz: 'Yangi buyurtma (lead)',
    name_ru: 'Новый заказ (лид)',
    name_en: 'New Order (lead)',
    bg_color: '#E3F2FD',
    color: '#1976D2',
  },
  {
    type: 'Cancelled',
    name_uz: 'Bekor qilingan',
    name_ru: 'Отменен',
    name_en: 'Cancelled',
    bg_color: '#FFEBEE',
    color: '#D32F2F',
  },
  {
    type: 'Completed',
    name_uz: 'Topshirildi',
    name_ru: 'Выдан',
    name_en: 'Completed',
    bg_color: '#E8F5E8',
    color: '#2E7D32',
  },
  {
    type: 'Invalid',
    name_uz: 'Sifatsiz',
    name_ru: 'Некачественный',
    name_en: 'Invalid',
    bg_color: '#F5F5F5',
    color: '#9E9E9E',
  },
  {
    type: 'Missed',
    name_uz: "Ko'tarmadi",
    name_ru: 'Не поднял трубку',
    name_en: 'Missed',
    bg_color: '#FFF8E1',
    color: '#F9A825',
    updateTypeOnlyWhenNameMatches: true,
  },
];

async function ensureNoAnswerRejectCause() {
  const existing = await knex('repair_order_reject_causes')
    .whereRaw('LOWER(name) = LOWER(?)', [NO_ANSWER_REJECT_CAUSE_NAME])
    .orderByRaw("CASE WHEN status = 'Open' THEN 0 ELSE 1 END")
    .first();

  if (existing) {
    await knex('repair_order_reject_causes')
      .where({ id: existing.id })
      .update({
        is_active: true,
        status: 'Open',
        updated_at: new Date(),
      });
    console.log(`Ensured reject cause '${NO_ANSWER_REJECT_CAUSE_NAME}' is active.`);
    return existing.id;
  }

  const maxSortResult = await knex('repair_order_reject_causes')
    .where({ status: 'Open' })
    .max('sort as maxSort')
    .first();
  const nextSort = (maxSortResult?.maxSort || 0) + 1;

  const [inserted] = await knex('repair_order_reject_causes')
    .insert({
      name: NO_ANSWER_REJECT_CAUSE_NAME,
      description: NO_ANSWER_REJECT_CAUSE_NAME,
      sort: nextSort,
      is_active: true,
      status: 'Open',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('id');

  const insertedId = typeof inserted === 'object' ? inserted.id : inserted;
  console.log(`Created reject cause '${NO_ANSWER_REJECT_CAUSE_NAME}' (id: ${insertedId}).`);
  return insertedId;
}

async function copyOpenPermissionsToMissed(branchId, openStatusId, missedStatusId) {
  const openPermissions = await knex('repair_order_status_permissions').where({
    branch_id: branchId,
    status_id: openStatusId,
  });

  for (const permission of openPermissions) {
    const insertData = { ...permission };
    delete insertData.id;

    insertData.status_id = missedStatusId;
    insertData.created_at = new Date();
    insertData.updated_at = new Date();

    await knex('repair_order_status_permissions')
      .insert(insertData)
      .onConflict(['branch_id', 'status_id', 'role_id'])
      .ignore();
  }
}

async function insertTransition(fromStatusId, toStatusId) {
  await knex('repair-order-status-transitions')
    .insert({
      from_status_id: fromStatusId,
      to_status_id: toStatusId,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict(['from_status_id', 'to_status_id'])
    .ignore();
}

async function ensureMissedWorkflow(branchId) {
  const [openStatus, missedStatus, invalidStatus] = await Promise.all([
    knex('repair_order_statuses')
      .where({ branch_id: branchId, type: 'Open', status: 'Open' })
      .orderByRaw('CASE WHEN is_protected THEN 0 ELSE 1 END')
      .orderBy('sort', 'asc')
      .first(),
    knex('repair_order_statuses')
      .where({ branch_id: branchId, type: 'Missed', status: 'Open' })
      .orderByRaw('CASE WHEN is_protected THEN 0 ELSE 1 END')
      .orderBy('sort', 'asc')
      .first(),
    knex('repair_order_statuses')
      .where({ branch_id: branchId, type: 'Invalid', status: 'Open' })
      .orderByRaw('CASE WHEN is_protected THEN 0 ELSE 1 END')
      .orderBy('sort', 'asc')
      .first(),
  ]);

  if (!openStatus || !missedStatus) {
    console.log(`  Skipped Missed workflow wiring for branch ${branchId}; required statuses missing.`);
    return;
  }

  await copyOpenPermissionsToMissed(branchId, openStatus.id, missedStatus.id);
  await insertTransition(openStatus.id, missedStatus.id);
  await insertTransition(missedStatus.id, openStatus.id);

  if (invalidStatus) {
    await insertTransition(missedStatus.id, invalidStatus.id);
  }

  console.log(`  Ensured Missed status permissions and transitions for branch ${branchId}.`);
}

async function run() {
  console.log('🔄 Reconciling repair order statuses...');
  try {
    await ensureNoAnswerRejectCause();

    const branches = await knex('branches').where({ status: 'Open' }).select('id');
    console.log(`Found ${branches.length} branches.`);

    for (const branch of branches) {
      console.log(`Checking branch ${branch.id}...`);
      for (const required of REQUIRED_STATUSES) {
        // 1. Try to find by name first (strongest match for reconciliation)
        let statusByName = await knex('repair_order_statuses')
          .where({ branch_id: branch.id, name_uz: required.name_uz, status: 'Open' })
          .first();

        // 2. Try to find by type
        let statusByType = await knex('repair_order_statuses')
          .where({ branch_id: branch.id, type: required.type, status: 'Open' })
          .first();

        if (statusByName) {
          // If found by name, ensure it has the correct type and is protected
          const updateData = required.updateTypeOnlyWhenNameMatches
            ? {
                type: required.type,
                updated_at: new Date(),
              }
            : {
                type: required.type,
                is_protected: true,
                updated_at: new Date(),
              };

          await knex('repair_order_statuses').where({ id: statusByName.id }).update(updateData);
          console.log(`  Updated status '${required.name_uz}' (id: ${statusByName.id}) to type '${required.type}'.`);

          // If there was ANOTHER record with this type, we should clear its type to avoid ambiguity
          if (statusByType && statusByType.id !== statusByName.id) {
            await knex('repair_order_statuses').where({ id: statusByType.id }).update({ type: null });
            console.log(`  Cleared duplicate type '${required.type}' from status id: ${statusByType.id}.`);
          }
        } else if (statusByType) {
          // If only found by type, update its name (Safe because we know no one has this name)
          await knex('repair_order_statuses').where({ id: statusByType.id }).update({
            name_uz: required.name_uz,
            is_protected: true,
            updated_at: new Date(),
          });
          console.log(`  Updated type '${required.type}' (id: ${statusByType.id}) to name '${required.name_uz}'.`);
        } else {
          // 3. Optional: Check for old names to rename
          const oldNames = {
            'Open': 'Yangi buyurtma',
            'Completed': 'Yakunlangan'
          };

          let foundOld = false;
          if (oldNames[required.type]) {
            const statusOld = await knex('repair_order_statuses')
              .where({ branch_id: branch.id, name_uz: oldNames[required.type], status: 'Open' })
              .first();

            if (statusOld) {
              await knex('repair_order_statuses').where({ id: statusOld.id }).update({
                type: required.type,
                name_uz: required.name_uz,
                name_ru: required.name_ru,
                name_en: required.name_en,
                is_protected: true,
                updated_at: new Date(),
              });
              console.log(`  Renamed and typed old status '${oldNames[required.type]}' to '${required.type}' for branch ${branch.id}.`);
              foundOld = true;
            }
          }

          if (!foundOld) {
            // 4. Create new status
            const maxSortResult = await knex('repair_order_statuses')
              .where({ branch_id: branch.id })
              .max('sort as maxSort')
              .first();
            const nextSort = (maxSortResult.maxSort || 0) + 1;

            const [inserted] = await knex('repair_order_statuses').insert({
              branch_id: branch.id,
              name_uz: required.name_uz,
              name_ru: required.name_ru,
              name_en: required.name_en,
              type: required.type,
              bg_color: required.bg_color,
              color: required.color,
              is_protected: true,
              is_active: true,
              can_user_view: true,
              status: 'Open',
              sort: nextSort,
              created_at: new Date(),
              updated_at: new Date(),
            }).returning('id');
            const insertedId = typeof inserted === 'object' ? inserted.id : inserted;
            console.log(`  Created new status '${required.name_uz}' for type '${required.type}' (id: ${insertedId}).`);
          }
        }
      }

      await ensureMissedWorkflow(branch.id);
    }
    console.log('✅ Reconciliation complete.');
  } catch (error) {
    console.error('❌ Error during reconciliation:', error);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

run();
