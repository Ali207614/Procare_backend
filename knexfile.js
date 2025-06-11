const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 1. .env.local → dev uchun
// 2. .env.docker → docker/prod uchun
const envFile = process.env.ENV_FILE || '.env.local';

if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
} else {
    console.warn(`⚠️ ${envFile} topilmadi. Fallback: .env`);
    dotenv.config();
}

module.exports = {
    development: {
        client: 'pg',
        connection: {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        },
        migrations: {
            directory: './migrations',
        },
        seeds: {
            directory: './seeds',
        },
    },
};

// Hammasini o'chirish

// npx knex migrate:rollback --all

// Qayta qo'shish

// npx knex migrate:latest


// flushall - redis full delete

// npx knex seed:run

