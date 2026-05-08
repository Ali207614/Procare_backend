exports.seed = async function (knex) {
  // Clear the table
  await knex('app_features').del();

  const features = [
    {
      feature_key: 'system.operational',
      name: 'System Operational',
      description: 'Used to turn off specific modules during maintenance',
      is_active: true,
      updated_at: knex.fn.now(),
    },
    {
      feature_key: 'payments.enabled',
      name: 'Payments Enabled',
      description: 'Toggle payment gateways globally',
      is_active: true,
      updated_at: knex.fn.now(),
    },
    {
      feature_key: 'notifications.sms',
      name: 'SMS Notifications',
      description: 'Enable or disable SMS sending',
      is_active: true,
      updated_at: knex.fn.now(),
    }
  ];

  await knex('app_features').insert(features);
};
