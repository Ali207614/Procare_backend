const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('notifications').del();

  const admins = await knex('admins').select('id');
  if (admins.length === 0) {
    console.warn('⚠️ No admins found. Seed admins first.');
    return;
  }

  const now = new Date();

  const notifications = [
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4395889 завершён',
      message: 'Ваш заказ успешно завершён и готов к выдаче клиенту',
      type: 'success',
      is_read: false,
      meta: { order_id: '4395889', event: 'completed' },
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4395889 изменён',
      message: 'Статус заказа #4395889 был обновлён на "В ремонте"',
      type: 'info',
      is_read: false,
      meta: { order_id: '4395889', event: 'updated' },
      created_at: new Date(now.getTime() - 1000 * 60 * 30),
      updated_at: new Date(now.getTime() - 1000 * 60 * 30),
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Новый заказ #4396001',
      message: 'Создан новый заказ клиентом',
      type: 'info',
      is_read: true,
      meta: { order_id: '4396001', event: 'created' },
      created_at: new Date(now.getTime() - 1000 * 60 * 60),
      updated_at: new Date(now.getTime() - 1000 * 60 * 60),
      read_at: now,
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4396002 отменён',
      message: 'Заказ #4396002 был отменён клиентом',
      type: 'error',
      is_read: false,
      meta: { order_id: '4396002', event: 'canceled' },
      created_at: new Date(now.getTime() - 1000 * 60 * 90),
      updated_at: new Date(now.getTime() - 1000 * 60 * 90),
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4396003 изменён',
      message: 'Администратор обновил заказ #4396003',
      type: 'info',
      is_read: false,
      meta: { order_id: '4396003', event: 'updated' },
      created_at: new Date(now.getTime() - 1000 * 60 * 120),
      updated_at: new Date(now.getTime() - 1000 * 60 * 120),
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4396004 завершён',
      message: 'Ремонт по заказу #4396004 успешно завершён',
      type: 'success',
      is_read: true,
      meta: { order_id: '4396004', event: 'completed' },
      created_at: new Date(now.getTime() - 1000 * 60 * 150),
      updated_at: new Date(now.getTime() - 1000 * 60 * 150),
      read_at: now,
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Новый заказ #4396005',
      message: 'Создан новый заказ системой',
      type: 'info',
      is_read: false,
      meta: { order_id: '4396005', event: 'created' },
      created_at: new Date(now.getTime() - 1000 * 60 * 180),
      updated_at: new Date(now.getTime() - 1000 * 60 * 180),
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4396006 изменён',
      message: 'Заказ #4396006 был обновлён: добавлены детали ремонта',
      type: 'info',
      is_read: false,
      meta: { order_id: '4396006', event: 'updated' },
      created_at: new Date(now.getTime() - 1000 * 60 * 210),
      updated_at: new Date(now.getTime() - 1000 * 60 * 210),
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4396007 завершён',
      message: 'Ремонт по заказу #4396007 завершён и готов к выдаче',
      type: 'success',
      is_read: false,
      meta: { order_id: '4396007', event: 'completed' },
      created_at: new Date(now.getTime() - 1000 * 60 * 240),
      updated_at: new Date(now.getTime() - 1000 * 60 * 240),
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Новый заказ #4396008',
      message: 'Клиент оформил заказ #4396008 через приложение',
      type: 'info',
      is_read: true,
      meta: { order_id: '4396008', event: 'created' },
      created_at: new Date(now.getTime() - 1000 * 60 * 270),
      updated_at: new Date(now.getTime() - 1000 * 60 * 270),
      read_at: now,
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4396009 отменён',
      message: 'Система автоматически отменила заказ #4396009',
      type: 'error',
      is_read: false,
      meta: { order_id: '4396009', event: 'canceled' },
      created_at: new Date(now.getTime() - 1000 * 60 * 300),
      updated_at: new Date(now.getTime() - 1000 * 60 * 300),
    },
    {
      id: uuidv4(),
      admin_id: admins[0].id,
      title: 'Заказ #4396010 изменён',
      message: 'Обновлена стоимость заказа #4396010',
      type: 'warning',
      is_read: false,
      meta: { order_id: '4396010', event: 'updated' },
      created_at: new Date(now.getTime() - 1000 * 60 * 330),
      updated_at: new Date(now.getTime() - 1000 * 60 * 330),
    },
  ];

  // Add more notifications for other admins
  if (admins.length > 1) {
    for (let i = 1; i < Math.min(admins.length, 5); i++) {
      const adminNotifications = [
        {
          id: uuidv4(),
          admin_id: admins[i].id,
          title: 'Yangi buyurtma',
          message: `Yangi ta'mir buyurtmasi qabul qilindi - RO-2025-${String(100 + i).padStart(3, '0')}`,
          type: 'info',
          is_read: false,
          meta: { order_id: `RO-2025-${String(100 + i).padStart(3, '0')}`, event: 'created' },
          created_at: new Date(now.getTime() - i * 1000 * 60 * 15),
          updated_at: new Date(now.getTime() - i * 1000 * 60 * 15),
        },
        {
          id: uuidv4(),
          admin_id: admins[i].id,
          title: 'Buyurtma yangilandi',
          message: `Buyurtma RO-2025-${String(100 + i).padStart(3, '0')} holati o'zgardi`,
          type: 'info',
          is_read: i % 2 === 0,
          meta: { order_id: `RO-2025-${String(100 + i).padStart(3, '0')}`, event: 'updated' },
          created_at: new Date(now.getTime() - i * 1000 * 60 * 30),
          updated_at: new Date(now.getTime() - i * 1000 * 60 * 30),
          read_at: i % 2 === 0 ? new Date(now.getTime() - i * 1000 * 60 * 25) : null,
        },
        {
          id: uuidv4(),
          admin_id: admins[i].id,
          title: 'Qismlar yetib keldi',
          message: `Buyurtma RO-2025-${String(100 + i).padStart(3, '0')} uchun qismlar yetib keldi`,
          type: 'success',
          is_read: false,
          meta: { order_id: `RO-2025-${String(100 + i).padStart(3, '0')}`, event: 'parts_arrived' },
          created_at: new Date(now.getTime() - i * 1000 * 60 * 45),
          updated_at: new Date(now.getTime() - i * 1000 * 60 * 45),
        },
      ];
      notifications.push(...adminNotifications);
    }
  }

  await knex('notifications').insert(notifications);
};
