const MOTHER_BRANCH_ID = '00000000-0000-4000-8000-000000000000';
const SYSTEM_ADMIN_ID = '00000000-0000-4000-8000-000000000000';

exports.up = async function (knex) {
  const hasParentBranchId = await knex.schema.hasColumn('branches', 'parent_branch_id');
  if (!hasParentBranchId) {
    await knex.schema.alterTable('branches', (table) => {
      table.uuid('parent_branch_id').nullable().references('id').inTable('branches').onDelete('RESTRICT');
    });
  }

  await knex('branches')
    .insert({
      id: MOTHER_BRANCH_ID,
      name_uz: 'Texnik filial',
      name_ru: 'Технический филиал',
      name_en: 'Technical Branch',
      address_uz: 'Aniqlanmagan',
      address_ru: 'Не указано',
      address_en: 'Unknown',
      bg_color: '#cccccc',
      color: '#000000',
      status: 'Open',
      is_active: true,
      is_protected: true,
      parent_branch_id: null,
      created_by: await knex('admins').where({ id: SYSTEM_ADMIN_ID }).first('id') ? SYSTEM_ADMIN_ID : null,
      sort: 1,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })
    .onConflict('id')
    .merge({
      status: 'Open',
      is_active: true,
      is_protected: true,
      parent_branch_id: null,
      updated_at: knex.fn.now(),
    });

  await knex('branches')
    .whereNot({ id: MOTHER_BRANCH_ID })
    .where({ status: 'Open' })
    .update({ parent_branch_id: MOTHER_BRANCH_ID, updated_at: knex.fn.now() });

  await knex('branches')
    .where({ id: MOTHER_BRANCH_ID })
    .update({ parent_branch_id: null, is_active: true, is_protected: true, status: 'Open' });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS branches_parent_branch_id_idx
    ON branches (parent_branch_id);
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branches_one_level_hierarchy_chk'
          AND conrelid = 'branches'::regclass
      ) THEN
        ALTER TABLE branches
        ADD CONSTRAINT branches_one_level_hierarchy_chk
        CHECK (
          (id = '${MOTHER_BRANCH_ID}' AND parent_branch_id IS NULL)
          OR
          (id <> '${MOTHER_BRANCH_ID}' AND (parent_branch_id IS NULL OR parent_branch_id = '${MOTHER_BRANCH_ID}'::uuid))
        );
      END IF;
    END $$;
  `);

};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_one_level_hierarchy_chk;');
  await knex.raw('DROP INDEX IF EXISTS branches_parent_branch_id_idx;');

  const hasParentBranchId = await knex.schema.hasColumn('branches', 'parent_branch_id');
  if (hasParentBranchId) {
    await knex.schema.alterTable('branches', (table) => {
      table.dropColumn('parent_branch_id');
    });
  }
};
