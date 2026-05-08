exports.seed = async function (knex) {
  // Clear the mapping table first
  await knex('admin_branches').del();

  const admins = await knex('admins').select('id');
  const branches = await knex('branches').select('id');

  if (!admins.length || !branches.length) {
    console.log('No admins or branches found. Skipping admin_branches seed.');
    return;
  }

  const adminBranches = [];

  // Assign every admin to at least one branch
  for (let i = 0; i < admins.length; i++) {
    // We can assign Admin at index `i` to Branch at index `i % branches.length`
    adminBranches.push({
      admin_id: admins[i].id,
      branch_id: branches[i % branches.length].id,
    });
    
    // Potentially assign to a second branch if it's a super admin or higher level logic
    if (i < 2 && branches.length > 1) { 
      // i=0 and i=1 are usually super admins based on our 03_admins.js seed
      adminBranches.push({
        admin_id: admins[i].id,
        branch_id: branches[(i + 1) % branches.length].id,
      });
    }
  }

  // Use a quick reduce to remove accidental duplicates if branches.length is too small
  const uniqueMappings = Array.from(new Set(adminBranches.map(a => a.admin_id + '|' + a.branch_id)))
    .map(key => {
      const parts = key.split('|');
      return { admin_id: parts[0], branch_id: parts[1] };
    });

  await knex('admin_branches').insert(uniqueMappings);
};
