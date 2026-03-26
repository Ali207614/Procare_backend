#!/bin/sh
set -e

echo "⏳ Running database migrations..."
node_modules/.bin/knex migrate:latest --knexfile knexfile.js

echo "✅ Migrations complete. Starting application..."
exec "$@"
