const knexConfig = require('../knexfile.js');
const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

const CANONICAL_ROLES = [
  {
    id: '00000000-0000-4000-8000-000000000000',
    name: 'Super Admin',
    type: 'SuperAdmin',
    is_protected: true,
    aliases: ['super admin', 'superadmin'],
  },
  {
    id: 'af944273-f78c-4d84-84a6-01c46619785c',
    name: 'Operator',
    type: 'Operator',
    is_protected: false,
    aliases: ['operator'],
  },
  {
    id: 'cf78c0fc-75c1-4dc8-b942-d6ee624791a4',
    name: 'Spetsialist',
    type: 'Specialist',
    is_protected: false,
    aliases: ['spetsialist', 'specialist', 'spetialist'],
  },
  {
    id: 'afbc2f23-d78e-478e-b0d9-f20fb7930d72',
    name: 'Usta',
    type: 'Master',
    is_protected: false,
    aliases: ['usta', 'master'],
  },
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Courier',
    type: 'Courier',
    is_protected: true,
    aliases: ['courier'],
  },
];

async function findRole(trx, role) {
  const byId = await trx('roles').where({ id: role.id }).first();
  if (byId) return byId;

  const byType = await trx('roles').where({ type: role.type }).first();
  if (byType) return byType;

  return trx('roles')
    .whereRaw('LOWER(BTRIM(name)) = ANY(?::text[])', [
      role.aliases.map((alias) => alias.toLowerCase()),
    ])
    .orderByRaw("CASE WHEN status = 'Open' THEN 0 ELSE 1 END")
    .first();
}

async function ensureCanonicalRole(trx, role) {
  const existing = await findRole(trx, role);
  const now = new Date();

  if (!existing) {
    await trx('roles').insert({
      id: role.id,
      name: role.name,
      type: role.type,
      is_active: true,
      is_protected: role.is_protected,
      status: 'Open',
      created_at: now,
      updated_at: now,
    });
    return role.id;
  }

  await trx('roles')
    .where({ type: role.type })
    .whereNot({ id: existing.id })
    .update({ type: null, updated_at: now });

  await trx('roles').where({ id: existing.id }).update({
    name: role.name,
    type: role.type,
    is_active: true,
    is_protected: role.is_protected,
    status: 'Open',
    updated_at: now,
  });

  return existing.id;
}

async function grantAllPermissionsToSuperAdmin(trx, superAdminRoleId) {
  const permissionIds = await trx('permissions').pluck('id');
  if (!permissionIds.length) return;

  const existingPermissionIds = await trx('role_permissions')
    .where({ role_id: superAdminRoleId })
    .pluck('permission_id');
  const existing = new Set(existingPermissionIds);

  const missing = permissionIds
    .filter((permissionId) => !existing.has(permissionId))
    .map((permissionId) => ({
      role_id: superAdminRoleId,
      permission_id: permissionId,
    }));

  if (missing.length) {
    await trx('role_permissions').insert(missing).onConflict(['role_id', 'permission_id']).ignore();
  }
}

async function main() {
  const hasType = await knex.schema.hasColumn('roles', 'type');
  if (!hasType) {
    throw new Error('roles.type column is missing. Run migrations before reconciling roles.');
  }

  await knex.transaction(async (trx) => {
    const resolvedIds = {};

    for (const role of CANONICAL_ROLES) {
      resolvedIds[role.type] = await ensureCanonicalRole(trx, role);
    }

    await grantAllPermissionsToSuperAdmin(trx, resolvedIds.SuperAdmin);
  });

  console.log('Canonical roles reconciled successfully.');
}

main()
  .catch((error) => {
    console.error('Failed to reconcile canonical roles:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await knex.destroy();
  });
