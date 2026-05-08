const { Redis } = require('ioredis');
require('dotenv').config();

async function checkRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  });

  const adminId = '00000000-0000-4000-8000-000000000000';
  const cacheKey = `admin:${adminId}:permissions`;
  
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('Cached permissions in Redis:');
    console.log(JSON.parse(cached));
  } else {
    console.log('No permissions cached in Redis for this admin.');
  }

  await redis.quit();
}

checkRedis().catch(console.error);
