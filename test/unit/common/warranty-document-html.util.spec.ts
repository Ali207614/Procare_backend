import { toWarrantyDocumentPdfHtml } from 'src/common/utils/warranty-document-html.util';

describe('warranty-document-html.util', () => {
  it('converts plain text to HTML paragraphs', () => {
    const text = 'Hello world.\n\nThis is a second paragraph.';
    const result = toWarrantyDocumentPdfHtml(text);
    expect(result).toContain('<p>Hello world.</p>');
    expect(result).toContain('<p>This is a second paragraph.</p>');
  });

  it('converts markdown headings to HTML headings', () => {
    const text = '## 1. Kafolat muddati\n\n### Detail section';
    const result = toWarrantyDocumentPdfHtml(text);
    expect(result).toContain('<h2>1. Kafolat muddati</h2>');
    expect(result).toContain('<h3>Detail section</h3>');
  });

  it('converts markdown bullet lists to HTML unordered lists', () => {
    const text = '* Item 1\n* Item 2';
    const result = toWarrantyDocumentPdfHtml(text);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item 1</li>');
    expect(result).toContain('<li>Item 2</li>');
    expect(result).toContain('</ul>');
  });

  it('preserves existing sanitized HTML tags', () => {
    const html = '<h2>Heading</h2><p>Paragraph with <strong>bold</strong> text.</p>';
    const result = toWarrantyDocumentPdfHtml(html);
    expect(result).toBe(html);
  });

  it('strips out disallowed tags like script', () => {
    const text = 'Some text <script>alert("xss")</script> here.';
    const result = toWarrantyDocumentPdfHtml(text);
    expect(result).not.toContain('<script>');
    expect(result).toBe('Some text  here.');
  });

  it('converts literal \\n sequences to actual newlines and parses markdown', () => {
    const text = 'Line 1.\\n\\n## 1. Heading\\n\\n* Item 1';
    const result = toWarrantyDocumentPdfHtml(text);
    expect(result).toContain('<p>Line 1.</p>');
    expect(result).toContain('<h2>1. Heading</h2>');
    expect(result).toContain('<li>Item 1</li>');
  });
});
