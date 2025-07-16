// utils/seed.util.js

function sanitizeDescription(str: string | null) {
  if (!str) return '';
  return str
    .replace(/ʼ|ʻ|’|‘/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7F]/g, '')
    .trim();
}

module.exports = {
  sanitizeDescription,
};
