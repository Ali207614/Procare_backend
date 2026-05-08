const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('campaign_recipient').del();
  await knex('campaigns').del();

  // Fetch at least one template to link to campaigns
  const template = await knex('templates').first();
  if (!template) {
    console.log('No templates found, skipping campaigns seed.');
    return;
  }

  // Fetch some users to make them recipients
  const users = await knex('users').limit(5);

  const campaigns = [
    {
      id: uuidv4(),
      template_id: template.id,
      filters: JSON.stringify({ source: 'telegram_bot' }),
      send_type: 'now',
      delivery_method: 'bot',
      status: 'completed',
      created_at: new Date(Date.now() - 86400000), // 1 day ago
      updated_at: new Date(Date.now() - 86400000),
    },
    {
      id: uuidv4(),
      template_id: template.id,
      filters: JSON.stringify({ language: 'uz' }),
      send_type: 'schedule',
      schedule_at: new Date(Date.now() + 86400000), // 1 day from now
      delivery_method: 'sms',
      status: 'scheduled',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    }
  ];

  await knex('campaigns').insert(campaigns);

  if (users.length > 0) {
    // Add recipients for the first campaign
    const recipients = users.map(user => ({
      id: uuidv4(),
      campaign_id: campaigns[0].id,
      user_id: user.id,
      status: 'sent',
      sent_at: campaigns[0].created_at,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    }));

    await knex('campaign_recipient').insert(recipients);
  }
};
