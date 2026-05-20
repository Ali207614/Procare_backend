import sanitizeHtml from 'sanitize-html';

/**
 * Converts warranty document content (plain text or HTML) into safe,
 * sanitized HTML suitable for rendering in PDF templates.
 *
 * - If the content already contains HTML tags, it is sanitized with a strict allowlist.
 * - If the content is plain text, it is converted to structured HTML
 *   (paragraphs, lists, numbered headings).
 */
export function toWarrantyDocumentPdfHtml(content: string): string {
  const trimmed = content.trim();

  if (containsHtml(trimmed)) {
    return sanitizeHtml(trimmed, {
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

  return plainTextToHtml(trimmed);
}

function containsHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(value: string): string {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }

      const escaped = escapeHtml(lines.join(' '));
      const numberedSection = escaped.match(/^(\d+\.\s*[^:]+:)(\s*.*)$/);

      if (numberedSection) {
        return `<p><strong>${numberedSection[1]}</strong>${numberedSection[2]}</p>`;
      }

      if (/^[^.!?]+:$/.test(escaped)) {
        return `<p><strong>${escaped}</strong></p>`;
      }

      return `<p>${escaped}</p>`;
    })
    .join('');
}
