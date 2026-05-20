import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';

/**
 * Converts warranty document content (plain text or HTML) into safe,
 * sanitized HTML suitable for rendering in PDF templates.
 *
 * - If the content already contains HTML tags, it is sanitized with a strict allowlist.
 * - If the content is plain text, it is converted to structured HTML via marked.
 */
export function toWarrantyDocumentPdfHtml(content: string): string {
  // Normalize literal '\n' and '\r' sequences to actual newlines
  const normalized = content
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');
  const trimmed = normalized.trim();

  let html: string;
  if (containsHtml(trimmed)) {
    html = trimmed;
  } else {
    html = marked.parse(trimmed) as string;
  }

  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'ol',
      'ul',
      'li',
      'h1',
      'h2',
      'h3',
      'span',
    ],
    allowedAttributes: {},
  });
}

function containsHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}
