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
    // 👤 Admin profili
    { id: '00000000-0000-0000-0000-000000000002', name: 'admin.profile.edit.basic', description: 'Profilni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'admin.profile.edit.sensitive', description: 'Maxfiy maʼlumot tahriri' },

    // 👥 Admin boshqaruvi
    { id: '00000000-0000-0000-0000-000000000004', name: 'admin.manage.view', description: 'Adminlarni ko‘rish' },
    { id: '00000000-0000-0000-0000-000000000005', name: 'admin.manage.create', description: 'Admin yaratish' },
    { id: '00000000-0000-0000-0000-000000000006', name: 'admin.manage.update', description: 'Adminni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000007', name: 'admin.manage.delete', description: 'Adminni o‘chirish' },
    { id: '00000000-0000-0000-0000-000000000008', name: 'admin.manage.ban', description: 'Adminni bloklash' },

    // 🏷 Statuslar
    { id: '00000000-0000-0000-0000-000000000009', name: 'status.view', description: 'Statuslarni ko‘rish' },
    { id: '00000000-0000-0000-0000-000000000010', name: 'status.create', description: 'Status yaratish' },
    { id: '00000000-0000-0000-0000-000000000011', name: 'status.update', description: 'Statusni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000012', name: 'status.delete', description: 'Statusni o‘chirish' },

    // 🧩 Status ruxsatlari
    { id: '00000000-0000-0000-0000-000000000013', name: 'status.permission.view', description: 'Ruxsatni ko‘rish' },
    { id: '00000000-0000-0000-0000-000000000014', name: 'status.permission.create', description: 'Ruxsat yaratish' },
    { id: '00000000-0000-0000-0000-000000000015', name: 'status.permission.update', description: 'Ruxsatni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000016', name: 'status.permission.delete', description: 'Ruxsatni o‘chirish' },

    // 🧱 Rollar
    { id: '00000000-0000-0000-0000-000000000021', name: 'role.view', description: 'Rollarni ko‘rish' },
    { id: '00000000-0000-0000-0000-000000000022', name: 'role.create', description: 'Rol yaratish' },
    { id: '00000000-0000-0000-0000-000000000023', name: 'role.update', description: 'Rolni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000024', name: 'role.delete', description: 'Rolni o‘chirish' },

    // 🏢 Filiallar
    { id: '00000000-0000-0000-0000-000000000025', name: 'branch.view', description: 'Filiallarni ko‘rish' },
    { id: '00000000-0000-0000-0000-000000000026', name: 'branch.create', description: 'Filial yaratish' },
    { id: '00000000-0000-0000-0000-000000000027', name: 'branch.update', description: 'Filialni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000028', name: 'branch.delete', description: 'Filialni o‘chirish' },
    { id: '00000000-0000-0000-0000-000000000068', name: 'branch.assign.admins', description: 'Filialga admin biriktirish' },

    // 📱 Telefon kategoriyalari
    { id: '00000000-0000-0000-0000-000000000033', name: 'phone.category.view', description: 'Telefonlarni ko‘rish' },
    { id: '00000000-0000-0000-0000-000000000034', name: 'phone.category.create', description: 'Telefon yaratish' },
    { id: '00000000-0000-0000-0000-000000000035', name: 'phone.category.update', description: 'Telefonni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000036', name: 'phone.category.delete', description: 'Telefonni o‘chirish' },

    // ⚙️ Muammo kategoriyalari
    { id: '00000000-0000-0000-0000-000000000037', name: 'problem.category.view', description: 'Muammolarni ko‘rish' },
    { id: '00000000-0000-0000-0000-000000000038', name: 'problem.category.create', description: 'Muammo yaratish' },
    { id: '00000000-0000-0000-0000-000000000039', name: 'problem.category.update', description: 'Muammoni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000040', name: 'problem.category.delete', description: 'Muammoni o‘chirish' },

    // 🔗 Telefon–Muammo bog‘lash
    { id: '00000000-0000-0000-0000-000000000041', name: 'phone.problem.link', description: 'Telefonni bog‘lash' },
    { id: '00000000-0000-0000-0000-000000000042', name: 'phone.problem.unlink', description: 'Telefonni ajratish' },

    // 🧠 OS turlari
    { id: '00000000-0000-0000-0000-000000000043', name: 'phone.os.view', description: 'OS turlarini ko‘rish' },
    { id: '00000000-0000-0000-0000-000000000044', name: 'phone.os.create', description: 'OS turi yaratish' },
    { id: '00000000-0000-0000-0000-000000000045', name: 'phone.os.update', description: 'OS turini tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000046', name: 'phone.os.delete', description: 'OS turini o‘chirish' },

    // 🔄 Status o‘tishlari
    { id: '00000000-0000-0000-0000-000000000051', name: 'repair.status.transition', description: 'Status o‘tish boshqaruvi' },
    { id: '00000000-0000-0000-0000-000000000052', name: 'repair.status.permission', description: 'Status ruxsat boshqaruvi' },

    // 👥 Foydalanuvchilar
    { id: '00000000-0000-0000-0000-000000000053', name: 'user.create', description: 'Foydalanuvchi yaratish' },
    { id: '00000000-0000-0000-0000-000000000054', name: 'user.update', description: 'Foydalanuvchini tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000055', name: 'user.delete', description: 'Foydalanuvchini o‘chirish' },

    // 🧰 Ta’mir qismlari
    { id: '00000000-0000-0000-0000-000000000056', name: 'repair.part.create', description: 'Qism yaratish' },
    { id: '00000000-0000-0000-0000-000000000057', name: 'repair.part.update', description: 'Qismni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000058', name: 'repair.part.delete', description: 'Qismni o‘chirish' },
    { id: '00000000-0000-0000-0000-000000000059', name: 'repair.part.assign', description: 'Qismni biriktirish' },

    // 🧾 Shablonlar
    { id: '00000000-0000-0000-0000-000000000060', name: 'template.create', description: 'Shablon yaratish' },
    { id: '00000000-0000-0000-0000-000000000061', name: 'template.update', description: 'Shablonni tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000062', name: 'template.delete', description: 'Shablonni o‘chirish' },

    // 📣 Kampaniyalar
    { id: '00000000-0000-0000-0000-000000000063', name: 'campaign.create', description: 'Kampaniya yaratish' },
    { id: '00000000-0000-0000-0000-000000000064', name: 'campaign.update', description: 'Kampaniyani tahrirlash' },
    { id: '00000000-0000-0000-0000-000000000065', name: 'campaign.delete', description: 'Kampaniyani o‘chirish' },
    { id: '00000000-0000-0000-0000-000000000066', name: 'campaign.pause', description: 'Kampaniyani to‘xtatish' },
    { id: '00000000-0000-0000-0000-000000000067', name: 'campaign.resume', description: 'Kampaniyani davom ettirish' },

    // 🔒 Ruxsatlar
    { id: '00000000-0000-0000-0000-000000000069', name: 'permission.view', description: 'Ruxsatlarni ko‘rish' },
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
