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
      const statusByName = await knex('repair_order_statuses')
        .where({ branch_id: branch.id, name_uz: required.name_uz, status: 'Open' })
        .first();

      const statusByType = await knex('repair_order_statuses')
        .where({ branch_id: branch.id, type: required.type, status: 'Open' })
        .orderByRaw('CASE WHEN is_protected THEN 0 ELSE 1 END')
        .orderBy('sort', 'asc')
        .first();

      if (statusByName) {
        await knex('repair_order_statuses').where({ id: statusByName.id }).update({
          type: required.type,
          name_uz: required.name_uz,
          name_ru: required.name_ru,
          name_en: required.name_en,
          is_protected: true,
          updated_at: new Date(),
        });

        if (statusByType && statusByType.id !== statusByName.id) {
          await knex('repair_order_statuses').where({ id: statusByType.id }).update({
            type: null,
            updated_at: new Date(),
          });
        }

        continue;
      }

      if (statusByType) {
        await knex('repair_order_statuses').where({ id: statusByType.id }).update({
          name_uz: required.name_uz,
          name_ru: required.name_ru,
          name_en: required.name_en,
          is_protected: true,
          updated_at: new Date(),
        });
        continue;
      }

      const oldNames = {
        Open: 'Yangi buyurtma',
        Completed: 'Yakunlangan',
      };

      if (oldNames[required.type]) {
        const oldStatus = await knex('repair_order_statuses')
          .where({ branch_id: branch.id, name_uz: oldNames[required.type], status: 'Open' })
          .first();

        if (oldStatus) {
          await knex('repair_order_statuses').where({ id: oldStatus.id }).update({
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
};

exports.down = async function () {
  // Rolling back data reconciliation is intentionally a no-op.
};
