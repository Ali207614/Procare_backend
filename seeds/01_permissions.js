
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

    { id: '00000000-0000-0000-0000-000000000002', name: 'admin.profile.edit.basic', description: 'Profil umumiy maydonlarini tahrirlash huquqi' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'admin.profile.edit.sensitive', description: 'Profil maxfiy maʼlumotlarini tahrirlash huquqi' },

    // Manage permissions
    { id: '00000000-0000-0000-0000-000000000004', name: 'admin.manage.view', description: 'Boshqa adminlarni ko‘rish huquqi' },
    { id: '00000000-0000-0000-0000-000000000005', name: 'admin.manage.create', description: 'Admin yaratish huquqi' },
    { id: '00000000-0000-0000-0000-000000000006', name: 'admin.manage.edit', description: 'Adminni o‘zgartirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000007', name: 'admin.manage.delete', description: 'Adminni o‘chirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000008', name: 'admin.manage.ban', description: 'Adminni bloklash huquqi' },

    // Status permissions
    { id: '00000000-0000-0000-0000-000000000009', name: 'status.view', description: 'Statuslarni ko‘rish huquqi' },
    { id: '00000000-0000-0000-0000-000000000010', name: 'status.create', description: 'Status yaratish huquqi' },
    { id: '00000000-0000-0000-0000-000000000011', name: 'status.update', description: 'Statusni o‘zgartirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000012', name: 'status.delete', description: 'Statusni o‘chirish huquqi' },

    // Status Permission
    { id: '00000000-0000-0000-0000-000000000013', name: 'status_permission.view', description: 'Status permissionlarni ko‘rish huquqi' },
    { id: '00000000-0000-0000-0000-000000000014', name: 'status_permission.create', description: 'Status permission yaratish huquqi' },
    { id: '00000000-0000-0000-0000-000000000015', name: 'status_permission.update', description: 'Status permissionni o‘zgartirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000016', name: 'status_permission.delete', description: 'Status permissionni o‘chirish huquqi' },


    // Role CRUD
    { id: '00000000-0000-0000-0000-000000000021', name: 'role.view', description: 'Rollarni ko‘rish huquqi' },
    { id: '00000000-0000-0000-0000-000000000022', name: 'role.create', description: 'Role yaratish huquqi' },
    { id: '00000000-0000-0000-0000-000000000023', name: 'role.update', description: 'Roleni o‘zgartirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000024', name: 'role.delete', description: 'Roleni o‘chirish huquqi' },

    // Branch CRUD
    { id: '00000000-0000-0000-0000-000000000025', name: 'branch.view', description: 'Filiallarni ko‘rish huquqi' },
    { id: '00000000-0000-0000-0000-000000000026', name: 'branch.create', description: 'Filial yaratish huquqi' },
    { id: '00000000-0000-0000-0000-000000000027', name: 'branch.update', description: 'Filialni o‘zgartirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000028', name: 'branch.delete', description: 'Filialni o‘chirish huquqi' },

    // Brand CRUD
    { id: '00000000-0000-0000-0000-000000000029', name: 'brand.view', description: 'Brandlarni ko‘rish huquqi' },
    { id: '00000000-0000-0000-0000-000000000030', name: 'brand.create', description: 'Brand yaratish huquqi' },
    { id: '00000000-0000-0000-0000-000000000031', name: 'brand.update', description: 'Brandni o‘zgartirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000032', name: 'brand.delete', description: 'Brandni o‘chirish huquqi' },

    // Phone CRUD
    { id: '00000000-0000-0000-0000-000000000033', name: 'phone-category.view', description: 'Telefonlarni ko‘rish huquqi' },
    { id: '00000000-0000-0000-0000-000000000034', name: 'phone-category.create', description: 'Telefon yaratish huquqi' },
    { id: '00000000-0000-0000-0000-000000000035', name: 'phone-category.update', description: 'Telefonni o‘zgartirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000036', name: 'phone-category.delete', description: 'Telefonni o‘chirish huquqi' },

    // Problem CRUD
    { id: '00000000-0000-0000-0000-000000000037', name: 'problem-category.view', description: 'Muammolarni ko‘rish huquqi' },
    { id: '00000000-0000-0000-0000-000000000038', name: 'problem-category.create', description: 'Muammo yaratish huquqi' },
    { id: '00000000-0000-0000-0000-000000000039', name: 'problem-category.update', description: 'Muammoni o‘zgartirish huquqi' },
    { id: '00000000-0000-0000-0000-000000000040', name: 'problem-category.delete', description: 'Muammoni o‘chirish huquqi' },
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
