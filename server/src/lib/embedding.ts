import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * Gemini text embedding (text-embedding-004 → 768 dimensions, free tier).
 * Used for semantic similarity search in product matching.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!config.gemini.apiKey) {
    logger.warn('embedText: GEMINI_API_KEY not configured');
    return null;
  }
  if (!text || !text.trim()) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.embeddingModel}:embedContent?key=${config.gemini.apiKey}`;
    const response = await axios.post(
      url,
      {
        model: `models/${config.gemini.embeddingModel}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: 768, // match pgvector Vector(768) column
      },
      { timeout: 15000 },
    );
    return response.data?.embedding?.values || null;
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`embedText error: ${msg}`);
    return null;
  }
}

/** Hash raw text to skip re-embedding when source text hasn't changed. */
export function hashText(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);
}

/**
 * Build a semantic description of a product — what gets embedded.
 * Order: type → material → capacity → shape → color → neck → description → industries.
 */
export function buildProductEmbeddingText(p: {
  name: string;
  description?: string | null;
  material?: string | null;
  capacity_ml?: number | null;
  shape?: string | null;
  color?: string | null;
  custom_color?: string | null;
  neck_type?: string | null;
  neck_spec?: string | null;
  industries?: string[] | null;
}): string {
  const parts: string[] = [p.name];
  if (p.material) parts.push(`chất liệu ${p.material}`);
  if (p.capacity_ml) parts.push(`dung tích ${p.capacity_ml}ml`);
  if (p.shape) parts.push(`hình dáng ${p.shape}`);
  if (p.color) parts.push(`màu ${p.custom_color || p.color}`);
  if (p.neck_type) parts.push(`cổ ${p.neck_type}${p.neck_spec ? ` ${p.neck_spec}` : ''}`);
  if (p.description) parts.push(p.description);
  if (p.industries && p.industries.length > 0) parts.push(`dùng cho: ${p.industries.join(', ')}`);
  return parts.join(' · ');
}

/**
 * Build query text from detected image attributes — same shape as product text
 * so the two embeddings land in the same semantic space.
 */
export function buildQueryEmbeddingText(attrs: {
  loai?: string | null;
  chat_lieu?: string | null;
  dung_tich_ml?: number | null;
  mau?: string | null;
  hinh_dang?: string | null;
  co_chai_mm?: number | null;
  ghi_chu?: string | null;
  ten_tu_nhan?: string | null;
  brand?: string | null;
}): string {
  const parts: string[] = [];
  if (attrs.loai) parts.push(attrs.loai);
  if (attrs.chat_lieu) parts.push(`chất liệu ${attrs.chat_lieu}`);
  if (attrs.dung_tich_ml) parts.push(`dung tích ${attrs.dung_tich_ml}ml`);
  if (attrs.hinh_dang) parts.push(`hình dáng ${attrs.hinh_dang}`);
  if (attrs.mau) parts.push(`màu ${attrs.mau}`);
  if (attrs.co_chai_mm) parts.push(`cổ ${attrs.co_chai_mm}mm`);
  if (attrs.ten_tu_nhan) parts.push(attrs.ten_tu_nhan);
  if (attrs.brand) parts.push(`brand ${attrs.brand}`);
  if (attrs.ghi_chu) parts.push(attrs.ghi_chu);
  return parts.join(' · ');
}
