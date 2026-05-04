/**
 * Strip markdown bold/italic/heading markers from a complete string.
 * Used for non-streaming responses and final flush.
 */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*]\s/gm, '• ');
}

/**
 * Streaming-safe markdown stripper. Buffers trailing chars that could be
 * the start of a multi-char marker (**, __) and returns safe output + remainder.
 */
export function stripMarkdownStream(buf: string): { safe: string; remainder: string } {
  const lastChar = buf.slice(-1);
  const pending = lastChar === '*' || lastChar === '_' ? 1 : 0;
  const safe = stripMarkdown(buf.slice(0, buf.length - pending));
  const remainder = buf.slice(buf.length - pending);
  return { safe, remainder };
}

/**
 * Sanitize customer-facing Zalo reply: remove forbidden emojis, markdown,
 * and detect/fix duplicated paragraphs (LLM sometimes emits same text twice).
 */
export function sanitizeCustomerReply(raw: string): string {
  let s = (raw || '').trim();
  if (!s) return '';
  s = stripMarkdown(s);
  s = s.replace(/🙏|👍|🥰|❤️|💯|🎉|✨|⭐|🔥/g, '');
  const half = Math.floor(s.length / 2);
  if (half > 30) {
    const left = s.slice(0, half).trim();
    const right = s.slice(half).trim();
    if (left && right && left.replace(/\s+/g, '') === right.replace(/\s+/g, '')) {
      s = left;
    }
  }
  const paragraphs = s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const dedup: string[] = [];
  for (const p of paragraphs) {
    if (dedup.length === 0 || dedup[dedup.length - 1] !== p) dedup.push(p);
  }
  return dedup.join('\n\n').replace(/\s+$/g, '');
}
