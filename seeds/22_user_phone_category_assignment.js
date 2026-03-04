exports.seed = async function (knex) {
  await knex('user_phone_category_assignment').del();

  const users = await knex('users').limit(15);
  const categories = await knex('phone_categories').limit(5);

  if (!users.length || !categories.length) {
    console.log('No users or phone categories found. Skipping user_phone_category_assignment seed.');
    return;
  }

  const assignments = [];

  for (let i = 0; i < users.length; i++) {
    // Give each user 1 to 2 phone categories
    assignments.push({
      user_id: users[i].id,
      phone_category_id: categories[i % categories.length].id,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });

    if (i % 3 === 0 && categories.length > 1) {
      assignments.push({
        user_id: users[i].id,
        phone_category_id: categories[(i + 1) % categories.length].id,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }

  await knex('user_phone_category_assignment').insert(assignments);
};
