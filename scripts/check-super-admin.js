const knex = require('knex');
const config = require('../knexfile');

async function check() {
  const db = knex(config.development);
  const superAdminRoleId = '00000000-0000-4000-8000-000000000000';

  // Check if there are any admins with the Super Admin role
  const adminsWithRole = await db('admin_roles')
    .where('role_id', superAdminRoleId)
    .select('admin_id');
  
  console.log('Admins with Super Admin role:', adminsWithRole);

  if (adminsWithRole.length > 0) {
    const adminId = adminsWithRole[0].admin_id;
    console.log(`Checking permissions for admin ${adminId}...`);
    
    const permissions = await db('admin_roles as ar')
      .join('roles as r', 'r.id', 'ar.role_id')
      .join('role_permissions as rp', 'rp.role_id', 'r.id')
      .join('permissions as p', 'p.id', 'rp.permission_id')
      .where('ar.admin_id', adminId)
      .andWhere('r.is_active', true)
      .andWhere('r.status', 'Open')
      .andWhere('p.is_active', true)
      .andWhere('p.status', 'Open')
      .select('p.name');
    
    console.log(`Admin has ${permissions.length} permissions in DB.`);
    console.log('Permission names:', permissions.map(p => p.name).sort());
    const hasAssign = permissions.some(p => p.name === 'repair.part.assign');
    console.log(`Has 'repair.part.assign' in DB: ${hasAssign}`);
  }

  await db.destroy();
}

check().catch(console.error);
