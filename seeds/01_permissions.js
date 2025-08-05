exports.seed = async function (knex) {
  function sanitizeDescription(str) {
    if (!str) return '';
    return str
      .replace(/ʼ|ʻ|’|‘/g, "'")
      .replace(/…/g, '...')
      .replace(/[^\x00-\x7F]/g, '')
      .trim();
  }
  await knex('permissions').del();

  const permissions = [
    // Profile permissions

    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'admin.profile.edit.basic',
      description: 'Profil umumiy maydonlarini tahrirlash huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'admin.profile.edit.sensitive',
      description: 'Profil maxfiy maʼlumotlarini tahrirlash huquqi',
    },

    // Manage permissions
    {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'admin.manage.view',
      description: 'Boshqa adminlarni ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'admin.manage.create',
      description: 'Admin yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      name: 'admin.manage.edit',
      description: 'Adminni o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000007',
      name: 'admin.manage.delete',
      description: 'Adminni o‘chirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000008',
      name: 'admin.manage.ban',
      description: 'Adminni bloklash huquqi',
    },

    // Status permissions
    {
      id: '00000000-0000-0000-0000-000000000009',
      name: 'status.view',
      description: 'Statuslarni ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'status.create',
      description: 'Status yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000011',
      name: 'status.update',
      description: 'Statusni o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000012',
      name: 'status.delete',
      description: 'Statusni o‘chirish huquqi',
    },

    // Status Permission
    {
      id: '00000000-0000-0000-0000-000000000013',
      name: 'status_permission.view',
      description: 'Status permissionlarni ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000014',
      name: 'status_permission.create',
      description: 'Status permission yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000015',
      name: 'status_permission.update',
      description: 'Status permissionni o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000016',
      name: 'status_permission.delete',
      description: 'Status permissionni o‘chirish huquqi',
    },

    // Role CRUD
    {
      id: '00000000-0000-0000-0000-000000000021',
      name: 'role.view',
      description: 'Rollarni ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000022',
      name: 'role.create',
      description: 'Role yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000023',
      name: 'role.update',
      description: 'Roleni o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000024',
      name: 'role.delete',
      description: 'Roleni o‘chirish huquqi',
    },

    // Branch CRUD
    {
      id: '00000000-0000-0000-0000-000000000025',
      name: 'branch.view',
      description: 'Filiallarni ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000026',
      name: 'branch.create',
      description: 'Filial yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000027',
      name: 'branch.update',
      description: 'Filialni o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000028',
      name: 'branch.delete',
      description: 'Filialni o‘chirish huquqi',
    },

    // Phone CRUD
    {
      id: '00000000-0000-0000-0000-000000000033',
      name: 'phone-category.view',
      description: 'Telefonlarni ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000034',
      name: 'phone-category.create',
      description: 'Telefon yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000035',
      name: 'phone-category.update',
      description: 'Telefonni o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000036',
      name: 'phone-category.delete',
      description: 'Telefonni o‘chirish huquqi',
    },

    // Problem CRUD
    {
      id: '00000000-0000-0000-0000-000000000037',
      name: 'problem-category.view',
      description: 'Muammolarni ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000038',
      name: 'problem-category.create',
      description: 'Muammo yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000039',
      name: 'problem-category.update',
      description: 'Muammoni o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000040',
      name: 'problem-category.delete',
      description: 'Muammoni o‘chirish huquqi',
    },

    {
      id: '00000000-0000-0000-0000-000000000041',
      name: 'phone-problem-mapping.create',
      description: 'Telefon va muomolarni bog‘lash',
    },
    {
      id: '00000000-0000-0000-0000-000000000042',
      name: 'phone-problem-mapping.delete',
      description: 'Telefon va muomolarni o‘chirish',
    },

    {
      id: '00000000-0000-0000-0000-000000000043',
      name: 'phone-os-type.view',
      description: 'Telefon os type ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000044',
      name: 'phone-os-type.create',
      description: 'Telefon os type yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000045',
      name: 'phone-os-type.update',
      description: 'Telefon os type o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000046',
      name: 'phone-os-type.delete',
      description: 'Telefon os type o‘chirish',
    },

    {
      id: '00000000-0000-0000-0000-000000000047',
      name: 'repair_order_status.create',
      description: 'Branch Status ko‘rish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000048',
      name: 'repair_order_status.view',
      description: 'Branch Status yaratish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000049',
      name: 'repair_order_status.update',
      description: 'Branch Status o‘zgartirish huquqi',
    },
    {
      id: '00000000-0000-0000-0000-000000000050',
      name: 'repair_order_status.delete',
      description: 'Branch Status o‘chirish',
    },

    {
      id: '00000000-0000-0000-0000-000000000051',
      name: 'repair_order_status_transitions.manage',
      description: 'Branch Status Transition manage',
    },
    {
      id: '00000000-0000-0000-0000-000000000052',
      name: 'repair_order_status_permissions.manage',
      description: 'Branch Status Permssions manage',
    },
    {
      id: '00000000-0000-0000-0000-000000000053',
      name: 'user.manage.create',
      description: 'User create',
    },
    {
      id: '00000000-0000-0000-0000-000000000054',
      name: 'user.manage.update',
      description: 'User update',
    },
    {
      id: '00000000-0000-0000-0000-000000000055',
      name: 'user.manage.delete',
      description: 'User delete',
    },
    {
      id: '00000000-0000-0000-0000-000000000056',
      name: 'repair_part.create',
      description: 'Repair part manage',
    },
    {
      id: '00000000-0000-0000-0000-000000000057',
      name: 'repair_part.update',
      description: 'Repair part manage',
    },
    {
      id: '00000000-0000-0000-0000-000000000058',
      name: 'repair_part.delete',
      description: 'Repair part manage',
    },
    {
      id: '00000000-0000-0000-0000-000000000058',
      name: 'repair_part.assign_problem',
      description: 'Repair part manage',
    },
  ];

  for (const perm of permissions) {
    await knex('permissions').insert({
      id: perm.id,
      name: perm.name,
      description: sanitizeDescription(perm.description),
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }
};
