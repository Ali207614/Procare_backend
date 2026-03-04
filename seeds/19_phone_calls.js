const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('phone_calls').del();

  const users = await knex('users').limit(10);
  if (users.length === 0) {
    console.log('No users found, skipping phone calls seed.');
    return;
  }

  const phoneCalls = [];
  
  for (let i = 0; i < 20; i++) {
    const user = users[i % users.length];
    const isMissed = i % 5 === 0;
    
    phoneCalls.push({
      id: uuidv4(),
      uuid: uuidv4().replace(/-/g, '').substring(0, 32),
      caller: i % 2 === 0 ? user.phone_number1 : '101', // 101 represents an internal operator
      callee: i % 2 === 0 ? '101' : user.phone_number1,
      direction: i % 2 === 0 ? 'inbound' : 'outbound',
      event: isMissed ? 'call_missed' : 'call_end',
      call_duration: isMissed ? 15 : Math.floor(Math.random() * 300) + 30, // Random duration between 30 and 330 seconds
      dialog_duration: isMissed ? 0 : Math.floor(Math.random() * 250) + 10,
      hangup_cause: isMissed ? 'NO_ANSWER' : 'NORMAL_CLEARING',
      download_url: isMissed ? null : `https://api.onlinepbx.ru/domain.ru/download/${uuidv4()}.mp3`,
      user_id: user.id,
      created_at: new Date(Date.now() - i * 3600000), // Spaced by hours
      updated_at: new Date(Date.now() - i * 3600000),
    });
  }

  await knex('phone_calls').insert(phoneCalls);
};
