import puppeteer from 'puppeteer';
import logger from '../utils/logger';

/**
 * Block-based PDF renderer. Aura passes structured blocks (kv_list, table, summary,
 * text, image) — server renders consistent UNIKI-branded HTML → puppeteer → PDF.
 *
 * Aura must NEVER pass raw HTML for the body — only typed blocks. This keeps layout
 * consistent and prevents Aura from generating broken/unsafe markup.
 */

export type PdfBlock =
  | { type: 'heading'; level?: 1 | 2 | 3; text: string }
  | { type: 'text'; content: string }
  | { type: 'kv_list'; items: Array<{ label: string; value: string | number }> }
  | {
      type: 'table';
      headers: string[];
      rows: Array<Array<string | number>>;
      align?: Array<'left' | 'right' | 'center'>;
    }
  | {
      type: 'summary';
      items: Array<{ label: string; value: string | number; highlight?: boolean }>;
    }
  | { type: 'spacer'; height?: number }
  | { type: 'divider' }
  | {
      type: 'signature';
      left?: { label: string; name?: string };
      right?: { label: string; name?: string };
    };

export interface PdfDocument {
  title: string;
  subtitle?: string;
  blocks: PdfBlock[];
  orientation?: 'portrait' | 'landscape';
  footerNote?: string;
}

const BRAND_COLOR = '#1677ff';
const BRAND_NAME = 'UNIKI CRM';

function escapeHtml(input: string | number): string {
  const s = String(input ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBlock(block: PdfBlock): string {
  switch (block.type) {
    case 'heading': {
      const lvl = block.level || 2;
      return `<h${lvl} class="b-heading">${escapeHtml(block.text)}</h${lvl}>`;
    }
    case 'text':
      return `<p class="b-text">${escapeHtml(block.content).replace(/\n/g, '<br/>')}</p>`;
    case 'kv_list': {
      const rows = block.items
        .map(
          (it) =>
            `<tr><td class="kv-l">${escapeHtml(it.label)}</td><td class="kv-v">${escapeHtml(it.value)}</td></tr>`,
        )
        .join('');
      return `<table class="b-kv">${rows}</table>`;
    }
    case 'table': {
      const align = block.align || [];
      const ths = block.headers
        .map((h, i) => `<th class="ta-${align[i] || 'left'}">${escapeHtml(h)}</th>`)
        .join('');
      const trs = block.rows
        .map((r) => {
          const tds = r
            .map((c, i) => `<td class="ta-${align[i] || 'left'}">${escapeHtml(c)}</td>`)
            .join('');
          return `<tr>${tds}</tr>`;
        })
        .join('');
      return `<table class="b-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    }
    case 'summary': {
      const items = block.items
        .map(
          (it) =>
            `<div class="sum-item${it.highlight ? ' sum-hi' : ''}">
              <div class="sum-l">${escapeHtml(it.label)}</div>
              <div class="sum-v">${escapeHtml(it.value)}</div>
            </div>`,
        )
        .join('');
      return `<div class="b-summary">${items}</div>`;
    }
    case 'spacer':
      return `<div style="height:${block.height || 12}px"></div>`;
    case 'divider':
      return `<hr class="b-divider"/>`;
    case 'signature': {
      const cell = (s: { label: string; name?: string } | undefined): string => {
        if (!s) return '<td></td>';
        return `<td class="sig-cell">
          <div class="sig-label">${escapeHtml(s.label)}</div>
          <div class="sig-line"></div>
          <div class="sig-name">${escapeHtml(s.name || '')}</div>
        </td>`;
      };
      return `<table class="b-sig"><tr>${cell(block.left)}${cell(block.right)}</tr></table>`;
    }
    default:
      return '';
  }
}

const STYLES = `
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  font-size: 11pt;
  color: #1f1f1f;
  margin: 0;
  -webkit-print-color-adjust: exact;
}
.doc-header {
  display: flex; justify-content: space-between; align-items: flex-end;
  border-bottom: 2px solid ${BRAND_COLOR}; padding-bottom: 8pt; margin-bottom: 14pt;
}
.doc-title { font-size: 18pt; font-weight: 700; color: ${BRAND_COLOR}; margin: 0; }
.doc-sub { font-size: 10pt; color: #666; margin-top: 2pt; }
.doc-meta { font-size: 9pt; color: #888; text-align: right; }
.doc-brand { font-weight: 700; color: ${BRAND_COLOR}; font-size: 11pt; }
.b-heading { color: #222; margin: 14pt 0 6pt; font-weight: 600; }
h1.b-heading { font-size: 15pt; }
h2.b-heading { font-size: 13pt; border: 0.75pt solid #000; padding: 4pt 8pt; border-radius: 3pt; }
h3.b-heading { font-size: 11pt; color: #555; }
.b-text { margin: 6pt 0; line-height: 1.5; }
.b-kv { width: 100%; border-collapse: collapse; margin: 6pt 0; border: 0.75pt solid #000; }
.b-kv td { padding: 4pt 8pt; border: 0.75pt solid #000; vertical-align: top; }
.b-kv td.kv-l { color: #333; width: 35%; font-size: 10pt; background: #fafafa; }
.b-kv td.kv-v { font-weight: 500; color: #1f1f1f; }
.b-table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; border: 0.75pt solid #000; }
.b-table th { background: #f5f7fa; color: #000; padding: 6pt 8pt; border: 0.75pt solid #000; font-weight: 600; }
.b-table td { padding: 5pt 8pt; border: 0.75pt solid #000; }
.b-table tbody tr:nth-child(even) { background: #fafbfc; }
.ta-left { text-align: left; }
.ta-right { text-align: right; }
.ta-center { text-align: center; }
.b-summary { display: flex; gap: 8pt; flex-wrap: wrap; margin: 10pt 0; }
.sum-item { flex: 1 1 30%; min-width: 140pt; padding: 8pt 12pt; background: #fff; border: 0.75pt solid #000; border-radius: 4pt; }
.sum-hi { background: #fafafa; }
.sum-l { font-size: 9pt; color: #666; margin-bottom: 2pt; }
.sum-v { font-size: 13pt; font-weight: 700; color: #1f1f1f; }
.sum-hi .sum-v { color: ${BRAND_COLOR}; }
.b-divider { border: none; border-top: 1px solid #e0e0e0; margin: 12pt 0; }
.b-sig { width: 100%; margin-top: 24pt; }
.sig-cell { width: 50%; text-align: center; padding: 0 12pt; }
.sig-label { font-weight: 600; margin-bottom: 30pt; }
.sig-line { border-bottom: 1px solid #999; margin-bottom: 4pt; }
.sig-name { font-size: 10pt; color: #666; min-height: 14pt; }
.doc-footer { position: fixed; bottom: 6mm; left: 0; right: 0; text-align: center; font-size: 8pt; color: #aaa; }
`;

function buildHtml(doc: PdfDocument): string {
  const body = doc.blocks.map(renderBlock).join('\n');
  const meta = new Date().toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(doc.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${STYLES}</style>
</head>
<body>
  <div class="doc-header">
    <div>
      <h1 class="doc-title">${escapeHtml(doc.title)}</h1>
      ${doc.subtitle ? `<div class="doc-sub">${escapeHtml(doc.subtitle)}</div>` : ''}
    </div>
    <div class="doc-meta">
      <div class="doc-brand">${BRAND_NAME}</div>
      <div>${meta}</div>
    </div>
  </div>
  ${body}
  <div class="doc-footer">${escapeHtml(doc.footerNote || `${BRAND_NAME} — Generated ${meta}`)}</div>
</body>
</html>`;
}

/**
 * Render a structured document to a PDF buffer.
 */
export async function renderPdf(doc: PdfDocument): Promise<Buffer> {
  const html = buildHtml(doc);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: doc.orientation === 'landscape',
      printBackground: true,
      margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });
    return Buffer.from(pdf);
  } catch (err) {
    logger.error('renderPdf failed:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

/**
 * Helper to format VND amount with dot separators (consistent across all PDFs).
 */
export function fmtVND(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  return Math.round(Number(n)).toLocaleString('vi-VN');
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('vi-VN');
}
