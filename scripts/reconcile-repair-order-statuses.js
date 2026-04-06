const knexConfig = require('../knexfile.js');
const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

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
];

async function run() {
  console.log('🔄 Reconciling repair order statuses...');
  try {
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
          await knex('repair_order_statuses').where({ id: statusByName.id }).update({
            type: required.type,
            is_protected: true,
            updated_at: new Date(),
          });
          console.log(`  Updated status '${required.name_uz}' (id: ${statusByName.id}) to type '${required.type}' and protected.`);

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
            console.log(`  Created new status '${required.name_uz}' for type '${required.type}' (id: ${inserted.id}).`);
          }
        }
      }
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
