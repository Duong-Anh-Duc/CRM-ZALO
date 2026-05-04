import { config } from '../../../config';
import logger from '../../../utils/logger';
import { openai } from './openai-client';

export interface ProductImageAttrs {
  loai: string | null;
  chat_lieu: string | null;
  dung_tich_ml: number | null;
  mau: string | null;
  hinh_dang: string | null;
  co_chai_mm: number | null;
  ghi_chu: string | null;
  sku_tu_nhan: string | null;
  ten_tu_nhan: string | null;
  brand: string | null;
  text_khac: string | null;
  confidence: number;
}

const EMPTY_ATTRS: ProductImageAttrs = {
  loai: null, chat_lieu: null, dung_tich_ml: null, mau: null,
  hinh_dang: null, co_chai_mm: null, ghi_chu: null,
  sku_tu_nhan: null, ten_tu_nhan: null, brand: null, text_khac: null,
  confidence: 0,
};

/**
 * Extract packaging product attributes from a customer image URL.
 * Uses GPT-4o-mini vision with structured JSON output.
 */
export async function identifyProductFromImage(
  imageUrls: string | string[],
): Promise<ProductImageAttrs> {
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  const multi = urls.length > 1;
  try {
    let raw = '';
    for (let attempt = 0; attempt < 3 && !raw; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
      const userText = multi
        ? 'Các ảnh sau là CÙNG 1 sản phẩm. Tổng hợp thuộc tính:'
        : 'Phân tích ảnh bao bì này:';
      const response = await openai.chat.completions.create({
        model: config.openai.visionModel || config.openai.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Phân tích ảnh bao bì nhựa + đọc text trên nhãn nếu có. Trả JSON đúng schema:
{"loai":"chai|hu|nap|can|thung|tui|mang|hop|null","chat_lieu":"PET|HDPE|LDPE|PP|OPP|PVC|PS|ABS|PE|null","dung_tich_ml":number|null,"mau":"TRANSPARENT|WHITE|CUSTOM|null","hinh_dang":"ROUND|SQUARE|OVAL|FLAT|null","co_chai_mm":number|null,"ghi_chu":"string","sku_tu_nhan":"string|null","ten_tu_nhan":"string|null","brand":"string|null","text_khac":"string|null","confidence":0-1}

Phân biệt loại:
- chai: có cổ+nắp vặn, thân cứng
- hu: miệng rộng, ngắn
- nap: riêng cái nắp
- can: có quai xách
- thung: to đựng hàng
- tui: dẹt mỏng mềm (túi nilon/OPP/PE)
- mang: cuộn mỏng quấn hàng
- hop: hộp rỗng cứng

OCR: sku_tu_nhan = mã SP/SKU đọc trên nhãn; ten_tu_nhan = tên hiển thị; brand = logo/thương hiệu; text_khac = text khác. Null nếu không có.
Nếu KHÔNG phải bao bì nhựa → null + confidence=0. JSON thuần.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              ...urls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });
      raw = (response.choices[0]?.message?.content || '').trim();
    }
    if (!raw) raw = '{}';
    const parsed = JSON.parse(raw);
    return {
      loai: parsed.loai || null,
      chat_lieu: parsed.chat_lieu || null,
      dung_tich_ml: typeof parsed.dung_tich_ml === 'number' ? parsed.dung_tich_ml : null,
      mau: parsed.mau || null,
      hinh_dang: parsed.hinh_dang || null,
      co_chai_mm: typeof parsed.co_chai_mm === 'number' ? parsed.co_chai_mm : null,
      ghi_chu: parsed.ghi_chu || null,
      sku_tu_nhan: parsed.sku_tu_nhan || null,
      ten_tu_nhan: parsed.ten_tu_nhan || null,
      brand: parsed.brand || null,
      text_khac: parsed.text_khac || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    };
  } catch (err) {
    logger.error('identifyProductFromImage error:', err);
    return { ...EMPTY_ATTRS };
  }
}
