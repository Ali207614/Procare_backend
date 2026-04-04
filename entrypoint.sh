#!/bin/sh
set -e

echo "⏳ Running database migrations..."
node_modules/.bin/knex migrate:latest --knexfile knexfile.js
node scripts/reconcile-repair-order-statuses.js

echo "✅ Migrations complete. Starting application..."
exec "$@"
