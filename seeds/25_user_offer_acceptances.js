exports.seed = async function (knex) {
  await knex('user_offer_acceptances').del();

  const users = await knex('users').limit(15);
  const offers = await knex('offers').where('is_active', true).limit(1);

  if (!users.length || !offers.length) {
    console.log('No users or active offers found. Skipping user_offer_acceptances seed.');
    return;
  }

  const acceptances = [];

  for (let i = 0; i < users.length; i++) {
    // Only 80% of users have accepted the offer
    if (i % 5 !== 0) {
      acceptances.push({
        user_id: users[i].id,
        offer_id: offers[0].id,
        accepted_at: new Date(Date.now() - i * 86400000), // Random past dates
      });
    }
  }

  await knex('user_offer_acceptances').insert(acceptances);
};
