import { Knex } from 'knex';
const knexConfig: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) ?? 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  pool: {
    min: 2,
    max: 30,
    acquireTimeoutMillis: 20000,
  },
};

export default knexConfig;
