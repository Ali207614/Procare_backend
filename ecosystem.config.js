module.exports = {
  apps: [
    {
      name: 'procare-api',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
      },
    },
    {
      name: 'campaigns-worker',
      script: 'dist/campaigns/campaign.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
      },
    },
  ],
};
