const crypto = require('crypto');
const knexConfig = require('../knexfile.js');

const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

function valueToText(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeValue(value, valueType, normalizerKey) {
  if (value === null || value === undefined) return null;

  const trimmed = String(value).trim();
  if (trimmed.length === 0) return '';

  switch (valueType) {
    case 'phone':
      return normalizePhone(trimmed, normalizerKey);
    case 'email':
    case 'uuid':
      return trimmed.toLowerCase();
    case 'integer':
      return /^-?\d+$/.test(trimmed) ? String(Number.parseInt(trimmed, 10)) : trimmed;
    case 'decimal':
    case 'money':
      return trimmed.replace(/\s/g, '').replace(',', '.');
    case 'boolean':
      return normalizeBoolean(trimmed);
    case 'date':
      return normalizeDate(trimmed, false);
    case 'timestamp':
      return normalizeDate(trimmed, true);
    case 'url':
      return normalizeUrl(trimmed);
    case 'reference':
      return trimmed;
    case 'null':
      return null;
    default:
      return trimmed.toLowerCase();
  }
}

function normalizePhone(value, normalizerKey) {
  const digits = value.replace(/\D/g, '');

  if (normalizerKey === 'uz_phone_e164') {
    if (digits.length === 9) return `+998${digits}`;
    if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  }

  if (value.startsWith('+') && digits.length > 0) return `+${digits}`;
  return digits;
}

function normalizeBoolean(value) {
  const lower = value.toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(lower)) return 'true';
  if (['false', '0', 'no', 'n', 'off'].includes(lower)) return 'false';
  return lower;
}

function normalizeDate(value, includeTime) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return includeTime ? date.toISOString() : date.toISOString().slice(0, 10);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.toLowerCase();
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function maskValue(value) {
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}${'*'.repeat(Math.min(value.length - 4, 8))}${value.slice(-2)}`;
}

function prepareValue(field, value) {
  const rawText = valueToText(value);
  const rawNormalized = normalizeValue(rawText, field.value_type, field.normalizer_key);
  const rawHash = rawNormalized === null ? null : sha256(rawNormalized);

  if (field.redaction_strategy === 'omit') {
    return { value_text: null, value_normalized: null, value_hash: null };
  }

  if (field.redaction_strategy === 'hash_only') {
    return { value_text: null, value_normalized: null, value_hash: rawHash };
  }

  if (field.redaction_strategy === 'mask') {
    return {
      value_text: rawText === null ? null : maskValue(rawText),
      value_normalized: null,
      value_hash: rawHash,
    };
  }

  return {
    value_text: rawText,
    value_normalized: rawNormalized,
    value_hash: rawHash,
  };
}

function fieldSelector(field) {
  const path = field.field_path.split('.');
  if (path.length === 1) {
    return knex.ref(path[0]);
  }

  return knex.raw('?? #>> ?', [path[0], `{${path.slice(1).join(',')}}`]);
}

async function ensureCurrentValueNode(currentValue) {
  const existing = await knex('history_nodes').where({ current_value_id: currentValue.id }).first();

  if (existing) return;

  await knex('history_nodes').insert({
    node_type: 'current_value',
    label: `${currentValue.entity_table}.${currentValue.field_path}`,
    current_value_id: currentValue.id,
  });
}

async function backfillField(field) {
  const hasTable = await knex.schema.hasTable(field.entity_table);
  if (!hasTable) return { processed: 0, skipped: 0 };

  const baseColumn = field.field_path.split('.')[0];
  const hasColumn = await knex.schema.hasColumn(field.entity_table, baseColumn);
  if (!hasColumn) return { processed: 0, skipped: 0 };

  const rows = await knex(field.entity_table)
    .select({ entity_pk: 'id' })
    .select({ value: fieldSelector(field) });

  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.value === null || row.value === undefined) {
      skipped += 1;
      continue;
    }

    const prepared = prepareValue(field, row.value);
    const [currentValue] = await knex('history_current_values')
      .insert({
        entity_table: field.entity_table,
        entity_pk: String(row.entity_pk),
        field_path: field.field_path,
        value_type: field.value_type,
        value_text: prepared.value_text,
        value_normalized: prepared.value_normalized,
        value_hash: prepared.value_hash,
        ref_table: field.ref_table,
        ref_pk: field.value_type === 'reference' ? String(row.value) : null,
        ref_label: null,
        last_change_id: null,
        current_since: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .onConflict(['entity_table', 'entity_pk', 'field_path'])
      .merge({
        value_type: field.value_type,
        value_text: prepared.value_text,
        value_normalized: prepared.value_normalized,
        value_hash: prepared.value_hash,
        ref_table: field.ref_table,
        ref_pk: field.value_type === 'reference' ? String(row.value) : null,
        ref_label: null,
        updated_at: knex.fn.now(),
      })
      .returning('*');

    await ensureCurrentValueNode(currentValue);
    processed += 1;
  }

  return { processed, skipped };
}

async function run() {
  try {
    const fields = await knex('history_tracked_fields')
      .where({ is_active: true, track_current_value: true })
      .orderBy(['entity_table', 'field_path']);

    let processed = 0;
    let skipped = 0;

    for (const field of fields) {
      const result = await backfillField(field);
      processed += result.processed;
      skipped += result.skipped;
      console.log(`Backfilled ${field.entity_table}.${field.field_path}: ${result.processed} rows`);
    }

    console.log(
      `History current values backfill complete. Processed=${processed}, skipped=${skipped}`,
    );
  } catch (error) {
    console.error('History current values backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await knex.destroy();
  }
}

run();
