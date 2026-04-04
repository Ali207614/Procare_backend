exports.up = async function (knex) {
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

  const branches = await knex('branches').where({ status: 'Open' }).select('id');

  for (const branch of branches) {
    for (const required of REQUIRED_STATUSES) {
      // 1. Check if status with this type already exists for this branch
      let status = await knex('repair_order_statuses')
        .where({ branch_id: branch.id, type: required.type, status: 'Open' })
        .first();

      if (status) {
        // If it exists, ensure it has the correct name and is protected
        await knex('repair_order_statuses').where({ id: status.id }).update({
          name_uz: required.name_uz,
          is_protected: true,
          updated_at: new Date(),
        });
      } else {
        // 2. If not found by type, check if it exists by name_uz
        status = await knex('repair_order_statuses')
          .where({ branch_id: branch.id, name_uz: required.name_uz, status: 'Open' })
          .first();

        if (status) {
          // If found by name, set the type and make it protected
          await knex('repair_order_statuses').where({ id: status.id }).update({
            type: required.type,
            is_protected: true,
            updated_at: new Date(),
          });
        } else {
          // 3. Optional: Check for old names if we want to be smart
          // e.g. "Yangi buyurtma" -> "Open"
          // but the user only specified "Yangi buyurtma (lead)"
          // However, in my previous check I saw "Yangi buyurtma" was "Open".
          // If I don't rename it, I'll have two "Open" ish statuses or one without type.
          
          // Let's check if there's any status with this type but different name
          // (Wait, we already checked by type in step 1)
          
          // Let's check for the *old* names specifically to avoid duplicates
          const oldNames = {
            'Open': 'Yangi buyurtma',
            'Completed': 'Yakunlangan'
          };
          
          if (oldNames[required.type]) {
             status = await knex('repair_order_statuses')
              .where({ branch_id: branch.id, name_uz: oldNames[required.type], status: 'Open' })
              .first();
             
             if (status) {
                await knex('repair_order_statuses').where({ id: status.id }).update({
                  type: required.type,
                  name_uz: required.name_uz,
                  name_ru: required.name_ru,
                  name_en: required.name_en,
                  is_protected: true,
                  updated_at: new Date(),
                });
                continue;
             }
          }

          // 4. Create new status
          const maxSort = await knex('repair_order_statuses')
            .where({ branch_id: branch.id })
            .max('sort as maxSort')
            .first();
          const nextSort = (maxSort.maxSort || 0) + 1;

          await knex('repair_order_statuses').insert({
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
          });
        }
      }
    }
  }
};

exports.down = async function (knex) {
  // Rolling back data reconciliation is complex and usually not desired
  // because it might affect existing order histories if we were to delete.
  // We'll leave it as a no-op or just unprotect them.
};
