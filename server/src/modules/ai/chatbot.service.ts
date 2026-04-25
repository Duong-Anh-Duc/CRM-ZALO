import OpenAI from 'openai';
import { config } from '../../config';
import prisma from '../../lib/prisma';
import logger from '../../utils/logger';
import dayjs from 'dayjs';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseURL,
  timeout: 120000,
  maxRetries: 2,
});

// ── Cache ──
let cachedContext: string | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 60 seconds

// ── Function definitions for OpenAI ──
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_receivable_details',
      description: 'Lấy chi tiết công nợ phải thu theo từng khách hàng (bao gồm tổng nợ, đã thu, còn lại, quá hạn)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payable_details',
      description: 'Lấy chi tiết công nợ phải trả theo từng nhà cung cấp',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_list',
      description: 'Lấy danh sách khách hàng với thông tin đơn hàng, doanh thu, công nợ',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_supplier_list',
      description: 'Lấy danh sách nhà cung cấp với thông tin đơn mua, công nợ, sản phẩm',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_list',
      description: 'Lấy danh sách sản phẩm (SKU, tên, chất liệu, dung tích, giá)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_report',
      description: 'Lấy báo cáo tài chính: doanh thu, giá vốn, lợi nhuận gộp/ròng',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cash_book_details',
      description: 'Lấy chi tiết sổ quỹ theo danh mục thu/chi',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_orders',
      description: 'Lấy danh sách đơn hàng bán gần nhất với chi tiết sản phẩm',
      parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Số đơn cần lấy (mặc định 15)' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_return_details',
      description: 'Lấy danh sách phiếu trả hàng (trả bán + trả mua) gần nhất',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_customer',
      description: 'Tìm kiếm khách hàng theo tên hoặc số điện thoại',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Tên hoặc SĐT khách hàng' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_detail',
      description: 'Lấy chi tiết 1 đơn hàng cụ thể theo mã đơn',
      parameters: { type: 'object', properties: { order_code: { type: 'string', description: 'Mã đơn hàng (VD: SO-20260101-001)' } }, required: ['order_code'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_supplier',
      description: 'Tìm NCC theo tên hoặc SĐT — trả về id cần dùng cho các thao tác tiếp theo',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_product',
      description: 'Tìm sản phẩm theo tên hoặc SKU — trả về id cần cho các thao tác tạo đơn',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_product_by_image',
      description: 'Tìm SP từ ảnh. Có thể truyền nhiều ảnh cùng 1 SP để tổng hợp chính xác hơn. Trích xuất thuộc tính (loại, chất liệu, dung tích, màu, SKU/brand trên nhãn) rồi fuzzy-match catalog. LUÔN dùng tool này thay vì đoán keyword cho search_product.',
      parameters: {
        type: 'object',
        properties: {
          image_urls: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Mảng URL ảnh (1 hoặc nhiều ảnh của CÙNG 1 sản phẩm).',
          },
        },
        required: ['image_urls'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_customer',
      description: 'Tạo khách hàng mới. Trả về id khách vừa tạo.',
      parameters: {
        type: 'object',
        properties: {
          company_name: { type: 'string', description: 'Tên công ty hoặc tên KH cá nhân' },
          phone: { type: 'string' },
          email: { type: 'string' },
          contact_name: { type: 'string' },
          address: { type: 'string' },
          customer_type: { type: 'string', enum: ['INDIVIDUAL', 'BUSINESS'] },
          tax_code: { type: 'string' },
          debt_limit: { type: 'number' },
        },
        required: ['company_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_customer',
      description: 'Cập nhật thông tin KH (id là UUID từ search_customer)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          company_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
          contact_name: { type: 'string' }, address: { type: 'string' }, tax_code: { type: 'string' },
          debt_limit: { type: 'number' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_supplier',
      description: 'Tạo NCC mới',
      parameters: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
          contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, address: { type: 'string' },
          tax_code: { type: 'string' },
          payment_terms: { type: 'string', enum: ['NET_15', 'NET_30', 'NET_45', 'NET_60', 'COD'] },
        },
        required: ['company_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_supplier',
      description: 'Cập nhật NCC (id UUID)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          company_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
          contact_name: { type: 'string' }, address: { type: 'string' }, payment_terms: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_product',
      description: 'Tạo sản phẩm mới. SKU tự gen nếu không cung cấp.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          sku: { type: 'string' },
          retail_price: { type: 'number', description: 'Giá tham khảo' },
          material: { type: 'string', enum: ['PET', 'HDPE', 'LDPE', 'PP', 'PVC', 'PS', 'PC', 'OTHER'] },
          capacity_ml: { type: 'number' }, moq: { type: 'number' },
          category_id: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_product',
      description: 'Cập nhật sản phẩm (id UUID)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }, retail_price: { type: 'number' },
          moq: { type: 'number' }, description: { type: 'string' }, is_active: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_sales_order',
      description: 'Tạo đơn bán hàng. customer_id (UUID) + items (mỗi item gồm product_id UUID, quantity, unit_price).',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string' },
          expected_delivery: { type: 'string', description: 'YYYY-MM-DD' },
          notes: { type: 'string' },
          vat_rate: { type: 'string', enum: ['VAT_0', 'VAT_5', 'VAT_8', 'VAT_10'] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                customer_product_name: { type: 'string' },
                supplier_id: { type: 'string' },
                discount_pct: { type: 'number' },
              },
              required: ['product_id', 'quantity', 'unit_price'],
            },
          },
        },
        required: ['customer_id', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_sales_order_status',
      description: 'Đổi trạng thái đơn bán (DRAFT/CONFIRMED/SHIPPING/COMPLETED/CANCELLED)',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' }, status: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'] } },
        required: ['id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_sales_order',
      description: 'Sửa thông tin chung của đơn bán (KHÔNG sửa items — dùng add/remove_sales_order_item). Hỗ trợ: notes, expected_delivery (ngày giao YYYY-MM-DD), vat_rate, shipping_fee, other_fee, other_fee_note.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID đơn bán' },
          notes: { type: 'string' },
          expected_delivery: { type: 'string', description: 'YYYY-MM-DD' },
          vat_rate: { type: 'string', enum: ['VAT_0', 'VAT_5', 'VAT_8', 'VAT_10'] },
          shipping_fee: { type: 'number' },
          other_fee: { type: 'number' },
          other_fee_note: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_sales_order_item',
      description: 'Thêm 1 sản phẩm vào đơn bán DRAFT',
      parameters: {
        type: 'object',
        properties: {
          sales_order_id: { type: 'string' }, product_id: { type: 'string' },
          quantity: { type: 'number' }, unit_price: { type: 'number' },
          supplier_id: { type: 'string' }, customer_product_name: { type: 'string' },
        },
        required: ['sales_order_id', 'product_id', 'quantity', 'unit_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_purchase_order',
      description: 'Tạo đơn mua hàng. Phải link với sales_order_id. items: product_id + quantity + unit_price.',
      parameters: {
        type: 'object',
        properties: {
          sales_order_id: { type: 'string' }, supplier_id: { type: 'string' },
          expected_delivery: { type: 'string' }, notes: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { product_id: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'number' } },
              required: ['product_id', 'quantity', 'unit_price'],
            },
          },
        },
        required: ['sales_order_id', 'supplier_id', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_purchase_order_status',
      description: 'Đổi trạng thái đơn mua',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' }, status: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'] } },
        required: ['id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_purchase_order',
      description: 'Sửa thông tin chung của đơn mua (hiện hỗ trợ: notes, expected_delivery YYYY-MM-DD). KHÔNG sửa items.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID đơn mua' },
          notes: { type: 'string' },
          expected_delivery: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_receivable_payment',
      description: 'Ghi nhận thu tiền từ KH (FIFO phân bổ theo hóa đơn cũ nhất trước). evidence_url BẮT BUỘC.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string' }, amount: { type: 'number' },
          payment_date: { type: 'string', description: 'YYYY-MM-DD' },
          method: { type: 'string', enum: ['CASH', 'BANK_TRANSFER', 'OTHER'] },
          reference: { type: 'string' }, evidence_url: { type: 'string' },
        },
        required: ['customer_id', 'amount', 'payment_date', 'method', 'evidence_url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_payable_payment',
      description: 'Ghi nhận chi tiền trả NCC. evidence_url BẮT BUỘC.',
      parameters: {
        type: 'object',
        properties: {
          supplier_id: { type: 'string' }, amount: { type: 'number' },
          payment_date: { type: 'string' }, method: { type: 'string', enum: ['CASH', 'BANK_TRANSFER', 'OTHER'] },
          reference: { type: 'string' }, evidence_url: { type: 'string' },
        },
        required: ['supplier_id', 'amount', 'payment_date', 'method', 'evidence_url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_cash_transaction',
      description: 'Thêm giao dịch sổ quỹ (thu/chi)',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
          amount: { type: 'number' }, category_id: { type: 'string' },
          transaction_date: { type: 'string' }, description: { type: 'string' },
          reference: { type: 'string' },
        },
        required: ['type', 'amount', 'category_id', 'transaction_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_operating_cost',
      description: 'Thêm chi phí vận hành (điện, thuê...)',
      parameters: {
        type: 'object',
        properties: {
          category_id: { type: 'string' }, amount: { type: 'number' },
          date: { type: 'string' }, description: { type: 'string' },
        },
        required: ['category_id', 'amount', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_customer_product_price',
      description: 'Lưu/cập nhật giá bán riêng cho 1 KH + 1 SP',
      parameters: {
        type: 'object',
        properties: { customer_id: { type: 'string' }, product_id: { type: 'string' }, price: { type: 'number' } },
        required: ['customer_id', 'product_id', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_supplier_price',
      description: 'Tạo/sửa giá NCC cho 1 sản phẩm',
      parameters: {
        type: 'object',
        properties: {
          supplier_id: { type: 'string' }, product_id: { type: 'string' },
          purchase_price: { type: 'number' }, moq: { type: 'number' },
          lead_time_days: { type: 'number' }, is_preferred: { type: 'boolean' },
        },
        required: ['supplier_id', 'product_id', 'purchase_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_categories',
      description: 'Liệt kê danh mục (product category hoặc cash category hoặc operating-cost category)',
      parameters: {
        type: 'object',
        properties: { type: { type: 'string', enum: ['product', 'cash', 'operating_cost'] } },
        required: ['type'],
      },
    },
  },
  // ─── Invoice ───
  {
    type: 'function',
    function: {
      name: 'create_sales_invoice',
      description: 'Tạo hóa đơn bán từ 1 đơn bán đã CONFIRMED trở lên',
      parameters: {
        type: 'object',
        properties: { sales_order_id: { type: 'string' } },
        required: ['sales_order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_purchase_invoice',
      description: 'Tạo hoá đơn mua (PURCHASE) từ 1 đơn mua. Trả về HĐ ở trạng thái DRAFT — cần finalize_invoice để duyệt.',
      parameters: {
        type: 'object',
        properties: {
          purchase_order_id: { type: 'string', description: 'UUID đơn mua' },
          notes: { type: 'string', description: 'Ghi chú (optional)' },
        },
        required: ['purchase_order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_sales_invoice',
      description: 'Sửa hoá đơn bán đang DRAFT (chưa finalize). Hỗ trợ: notes, invoice_date (YYYY-MM-DD), vat_amount, subtotal, total.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID hoá đơn' },
          notes: { type: 'string' },
          invoice_date: { type: 'string', description: 'YYYY-MM-DD' },
          vat_amount: { type: 'number' },
          subtotal: { type: 'number' },
          total: { type: 'number' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finalize_invoice',
      description: 'Duyệt/hoàn tất hóa đơn (DRAFT → APPROVED)',
      parameters: {
        type: 'object',
        properties: { invoice_id: { type: 'string' } },
        required: ['invoice_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_invoice',
      description: 'Hủy hóa đơn',
      parameters: {
        type: 'object',
        properties: { invoice_id: { type: 'string' } },
        required: ['invoice_id'],
      },
    },
  },
  // ─── Return ───
  {
    type: 'function',
    function: {
      name: 'create_sales_return',
      description: 'Tạo phiếu trả hàng bán (KH trả lại)',
      parameters: {
        type: 'object',
        properties: {
          sales_order_id: { type: 'string' }, customer_id: { type: 'string' },
          return_date: { type: 'string' }, reason: { type: 'string' }, notes: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['product_id', 'quantity', 'unit_price'],
            },
          },
        },
        required: ['sales_order_id', 'customer_id', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_purchase_return',
      description: 'Tạo phiếu trả hàng mua (trả cho NCC)',
      parameters: {
        type: 'object',
        properties: {
          purchase_order_id: { type: 'string' }, supplier_id: { type: 'string' },
          return_date: { type: 'string' }, reason: { type: 'string' }, notes: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['product_id', 'quantity', 'unit_price'],
            },
          },
        },
        required: ['purchase_order_id', 'supplier_id', 'items'],
      },
    },
  },
  // ─── Delete / Cancel ───
  {
    type: 'function',
    function: {
      name: 'delete_customer',
      description: 'Xóa khách hàng (soft delete, chuyển is_active=false)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_supplier',
      description: 'Xóa NCC (soft delete)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_product',
      description: 'Xóa sản phẩm (soft delete)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_sales_order_item',
      description: 'Gỡ 1 item khỏi đơn bán DRAFT',
      parameters: {
        type: 'object',
        properties: { sales_order_id: { type: 'string' }, item_id: { type: 'string' } },
        required: ['sales_order_id', 'item_id'],
      },
    },
  },
  // ─── Create category ───
  {
    type: 'function',
    function: {
      name: 'create_product_category',
      description: 'Tạo danh mục sản phẩm mới',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_cash_category',
      description: 'Tạo danh mục sổ quỹ (type: INCOME/EXPENSE)',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, type: { type: 'string', enum: ['INCOME', 'EXPENSE'] } },
        required: ['name', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_operating_cost_category',
      description: 'Tạo danh mục chi phí vận hành',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    },
  },
  // ─── Payroll ───
  {
    type: 'function',
    function: {
      name: 'create_payroll_period',
      description: 'Tạo kỳ lương mới (year, month)',
      parameters: {
        type: 'object',
        properties: { year: { type: 'number' }, month: { type: 'number', description: '1-12' } },
        required: ['year', 'month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_payroll',
      description: 'Tính lương cho 1 kỳ (dựa vào công thức + nhân viên)',
      parameters: { type: 'object', properties: { period_id: { type: 'string' } }, required: ['period_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_payroll',
      description: 'Duyệt kỳ lương đã tính',
      parameters: { type: 'object', properties: { period_id: { type: 'string' } }, required: ['period_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_payroll_paid',
      description: 'Đánh dấu kỳ lương đã trả',
      parameters: { type: 'object', properties: { period_id: { type: 'string' } }, required: ['period_id'] },
    },
  },
  // ─── Alerts ───
  {
    type: 'function',
    function: {
      name: 'mark_alert_read',
      description: 'Đánh dấu alert đã đọc',
      parameters: { type: 'object', properties: { alert_id: { type: 'string' } }, required: ['alert_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'take_alert_action',
      description: 'Ghi nhận action đã thực hiện với alert (VD: ACKNOWLEDGED, RESCHEDULED)',
      parameters: {
        type: 'object',
        properties: {
          alert_id: { type: 'string' }, action: { type: 'string' },
          new_expected_date: { type: 'string', description: 'YYYY-MM-DD nếu action = RESCHEDULED' },
        },
        required: ['alert_id', 'action'],
      },
    },
  },
  // ─── Cash / Operating cost edits ───
  {
    type: 'function',
    function: {
      name: 'update_cash_transaction',
      description: 'Sửa giao dịch sổ quỹ đã tạo (id UUID)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          amount: { type: 'number' },
          category_id: { type: 'string' },
          transaction_date: { type: 'string', description: 'YYYY-MM-DD' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_cash_transaction',
      description: 'Xoá giao dịch sổ quỹ (id UUID). Không xoá được GD tự động.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_operating_cost',
      description: 'Sửa chi phí vận hành (id UUID)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          amount: { type: 'number' },
          category_id: { type: 'string' },
          cost_date: { type: 'string', description: 'YYYY-MM-DD' },
          description: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_operating_cost',
      description: 'Xoá chi phí vận hành (id UUID)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  // ─── Payment evidence ───
  {
    type: 'function',
    function: {
      name: 'update_receivable_payment_evidence',
      description: 'Cập nhật URL minh chứng (ảnh/PDF) cho 1 payment phải thu',
      parameters: {
        type: 'object',
        properties: {
          payment_id: { type: 'string' },
          evidence_url: { type: 'string' },
        },
        required: ['payment_id', 'evidence_url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_payable_payment_evidence',
      description: 'Cập nhật URL minh chứng (ảnh/PDF) cho 1 payment phải trả',
      parameters: {
        type: 'object',
        properties: {
          payment_id: { type: 'string' },
          evidence_url: { type: 'string' },
        },
        required: ['payment_id', 'evidence_url'],
      },
    },
  },
  // ─── Price deletions ───
  {
    type: 'function',
    function: {
      name: 'delete_customer_product_price',
      description: 'Xoá giá riêng của 1 KH cho 1 SP (id UUID của bản ghi customer_product_price)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_supplier_price',
      description: 'Xoá giá NCC cho 1 sản phẩm (id UUID của bản ghi supplier_price)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  // ─── Update / Delete return ───
  {
    type: 'function',
    function: {
      name: 'update_sales_return',
      description: 'Sửa phiếu trả hàng bán (chỉ đổi reason/notes, không đổi items)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_sales_return',
      description: 'Xoá phiếu trả hàng bán (chỉ khi chưa APPROVED/RECEIVING/COMPLETED)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_purchase_return',
      description: 'Sửa phiếu trả hàng mua (chỉ đổi reason/notes)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_purchase_return',
      description: 'Xoá phiếu trả hàng mua (chỉ khi chưa APPROVED/RECEIVING/COMPLETED)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  // ─── Employee profile (payroll) ───
  {
    type: 'function',
    function: {
      name: 'create_employee_profile',
      description: 'Tạo hồ sơ nhân viên (payroll). Bắt buộc user_id (UUID của User đã tồn tại). Mỗi User chỉ có 1 profile.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'UUID của User đã tồn tại' },
          base_salary: { type: 'number' },
          meal_allowance: { type: 'number' },
          phone_allowance: { type: 'number' },
          fuel_allowance: { type: 'number' },
          dependents: { type: 'number' },
          insurance_number: { type: 'string' },
          tax_code: { type: 'string' },
          bank_account: { type: 'string' },
          bank_name: { type: 'string' },
          employment_status: { type: 'string', enum: ['ACTIVE', 'PROBATION', 'INACTIVE'] },
          join_date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_employee_profile',
      description: 'Cập nhật hồ sơ nhân viên (id là EmployeeProfile id)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          base_salary: { type: 'number' },
          meal_allowance: { type: 'number' },
          phone_allowance: { type: 'number' },
          fuel_allowance: { type: 'number' },
          dependents: { type: 'number' },
          insurance_number: { type: 'string' },
          tax_code: { type: 'string' },
          bank_account: { type: 'string' },
          bank_name: { type: 'string' },
          employment_status: { type: 'string', enum: ['ACTIVE', 'PROBATION', 'INACTIVE'] },
          join_date: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_employee_profile',
      description: 'Nghỉ việc — đánh dấu employment_status = INACTIVE (soft delete)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  // ─── Update / Delete category ───
  {
    type: 'function',
    function: {
      name: 'update_product_category',
      description: 'Sửa danh mục sản phẩm (chỉ đổi tên)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_product_category',
      description: 'Xoá danh mục sản phẩm (soft delete, is_active=false)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_cash_category',
      description: 'Sửa danh mục sổ quỹ (chỉ đổi name hoặc is_active, KHÔNG đổi type)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          is_active: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_cash_category',
      description: 'Xoá danh mục sổ quỹ (soft delete, is_active=false)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_operating_cost_category',
      description: 'Sửa danh mục chi phí vận hành (chỉ đổi tên)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_operating_cost_category',
      description: 'Xoá danh mục chi phí vận hành (soft delete, is_active=false)',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
  // ─── Zalo (messages + threads + send) ───
  {
    type: 'function',
    function: {
      name: 'get_zalo_messages',
      description: 'Đọc tin nhắn Zalo đã sync (incoming + outgoing) từ DB. Lọc theo thời gian (hôm nay/tuần này/khoảng ngày), theo tên, sender_id hoặc group_id. Dùng khi user hỏi "tin nhắn zalo hôm nay", "tôi có nhắn với {tên} không", "tóm tắt hội thoại với {tên}".',
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'all', 'custom'], description: 'Khoảng thời gian — mặc định "all" nếu hỏi "tôi có nhắn với ai không"' },
          from_date: { type: 'string', description: 'YYYY-MM-DD (dùng khi range=custom)' },
          to_date: { type: 'string', description: 'YYYY-MM-DD (dùng khi range=custom)' },
          search: { type: 'string', description: 'Tìm theo TÊN người gửi (sender_name) hoặc NỘI DUNG tin nhắn — case-insensitive. Ưu tiên khi user hỏi theo tên như "Trần Trung Kiên"' },
          sender_id: { type: 'string', description: 'Lọc theo 1 user_id cụ thể (nếu biết chính xác)' },
          group_id: { type: 'string', description: 'Lọc theo 1 group_id cụ thể' },
          direction: { type: 'string', enum: ['INCOMING', 'OUTGOING', 'ALL'], description: 'Mặc định ALL' },
          limit: { type: 'number', description: 'Số tin tối đa (mặc định 100, max 300)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_zalo_threads',
      description: 'Liệt kê các hội thoại Zalo (distinct sender_id/group_id) kèm last message + số tin. Có thể tìm theo tên người chat. Dùng khi user hỏi "tôi có nhắn với {tên} không", "có ai nhắn chưa rep", "danh sách khách đang chat".',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['user', 'group', 'all'], description: 'Mặc định all' },
          search: { type: 'string', description: 'Tìm theo TÊN người/nhóm (sender_name) — case-insensitive. VD "Trần Trung Kiên"' },
          limit: { type: 'number', description: 'Mặc định 20' },
          since_days: { type: 'number', description: 'Chỉ lấy thread có hoạt động trong N ngày (mặc định 30, dùng 365 nếu muốn tìm toàn bộ)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_zalo_message',
      description: 'Gửi tin nhắn tới 1 user Zalo (DM). Cần user_id (sender_id của Zalo). Nếu user nói theo TÊN ("nhắn cho Trần Trung Kiên là X"), TRƯỚC KHI GỬI phải:\n1. Gọi list_zalo_threads(search:"tên") để tìm sender_id, HOẶC search_customer/search_supplier(query:"tên") để lấy zalo_user_id.\n2. CÓ user_id → gọi tool NGAY, không hỏi lại. Nếu user đã nói đủ nội dung (VD "nhắn là chào em") thì GỬI LUÔN.\n3. Chỉ hỏi lại khi: tìm thấy >1 người cùng tên (ambiguous), hoặc user_id KHÔNG tìm được.\n4. Sau khi tool trả về thành công, báo lại ngắn gọn. KHÔNG hỏi "anh cần thêm gì không" — dư thừa.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'sender_id/user_id Zalo' },
          content: { type: 'string', description: 'Nội dung tin nhắn' },
        },
        required: ['user_id', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_zalo_group_message',
      description: 'Gửi tin nhắn vào group Zalo. Dùng khi user ra lệnh "nhắn vào nhóm {group} là ...". HỎI USER XÁC NHẬN trước khi gửi.',
      parameters: {
        type: 'object',
        properties: {
          group_id: { type: 'string', description: 'Zalo group_id' },
          content: { type: 'string', description: 'Nội dung tin nhắn' },
        },
        required: ['group_id', 'content'],
      },
    },
  },
  // ─── Export Excel (KH / NCC / SP) ───
  {
    type: 'function',
    function: {
      name: 'export_customers_excel',
      description: 'Xuất danh sách khách hàng ra file Excel. Dùng khi user ra lệnh "xuất danh sách KH", "export khách hàng", "in danh sách khách". Có thể kèm bộ lọc.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Tìm theo tên/SĐT (optional)' },
          customer_type: { type: 'string', enum: ['BUSINESS', 'INDIVIDUAL'], description: 'Lọc loại KH' },
          city: { type: 'string', description: 'Lọc theo thành phố/khu vực' },
          has_debt: { type: 'boolean', description: 'true = chỉ KH còn công nợ' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_suppliers_excel',
      description: 'Xuất danh sách nhà cung cấp ra Excel. Dùng khi user ra lệnh "xuất danh sách NCC", "export nhà cung cấp".',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          city: { type: 'string' },
          has_payable: { type: 'boolean', description: 'true = chỉ NCC còn nợ phải trả' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_products_excel',
      description: 'Xuất danh sách sản phẩm ra Excel. Dùng khi user ra lệnh "xuất SP", "export sản phẩm", "in catalog". Có thể lọc theo category/chất liệu/trạng thái.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          category_id: { type: 'string', description: 'ID danh mục SP' },
          material: { type: 'string', description: 'Chất liệu: PET, HDPE, PP, LDPE, OPP, PE, PVC' },
          is_active: { type: 'boolean', description: 'true = chỉ SP đang hoạt động' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_zalo_auto_reply',
      description: 'Bật/tắt auto-reply AI cho 1 thread Zalo cụ thể (thread_key = sender_id với DM, group_id với group). Dùng khi user ra lệnh "tắt bot cho {khách/group}", "bật auto-reply cho ...".',
      parameters: {
        type: 'object',
        properties: {
          thread_key: { type: 'string', description: 'sender_id (DM) hoặc group_id' },
          enabled: { type: 'boolean', description: 'true để bật, false để tắt' },
        },
        required: ['thread_key', 'enabled'],
      },
    },
  },
  // ─── AI Training (huấn luyện AI) ───
  {
    type: 'function',
    function: {
      name: 'list_ai_training',
      description: 'Liệt kê tất cả kiến thức đã huấn luyện cho Aura (business rules, product aliases, order examples, customer info). Dùng khi user hỏi "em đã được dạy những gì", "xem kiến thức đã học".',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Lọc theo category: PRODUCT_ALIAS, ORDER_EXAMPLE, CORRECTION, BUSINESS_RULE, CUSTOMER_INFO' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_ai_training',
      description: 'Thêm 1 kiến thức mới vào cơ sở huấn luyện Aura. Dùng khi user nói "nhớ cho anh là...", "từ giờ nếu KH nói X thì Y", "sản phẩm ABC còn được gọi là XYZ".',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['PRODUCT_ALIAS', 'ORDER_EXAMPLE', 'CORRECTION', 'BUSINESS_RULE', 'CUSTOMER_INFO'], description: 'Loại kiến thức' },
          title: { type: 'string', description: 'Tiêu đề ngắn' },
          content: { type: 'string', description: 'Nội dung chi tiết' },
        },
        required: ['category', 'title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_ai_training',
      description: 'Xoá 1 kiến thức khỏi huấn luyện. Dùng khi user nói "quên cái X đi", "xoá rule về Y".',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  // ─── Help ───
  {
    type: 'function',
    function: {
      name: 'help',
      description: 'Liệt kê tất cả khả năng hiện tại của Aura — trả lời khi user hỏi "em làm được gì", "có những chức năng gì"',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ── Tool implementations ──
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'get_receivable_details': {
      const receivables = await prisma.receivable.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        include: { customer: { select: { company_name: true, contact_name: true } } },
        orderBy: { remaining: 'desc' },
      });
      const byCustomer = new Map<string, any>();
      for (const r of receivables) {
        const name = r.customer?.company_name || r.customer?.contact_name || 'N/A';
        const e = byCustomer.get(r.customer_id) || { id: r.customer_id, name, total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
        e.total += Number(r.original_amount); e.paid += Number(r.paid_amount); e.remaining += Number(r.remaining); e.count++; if (r.status === 'OVERDUE') e.overdue++;
        byCustomer.set(r.customer_id, e);
      }
      return Array.from(byCustomer.values()).sort((a, b) => b.remaining - a.remaining)
        .map((c, i) => `${i + 1}. ${c.name} [id:${c.id}] | ${c.count} HĐ | Gốc: ${c.total.toLocaleString()} | Đã thu: ${c.paid.toLocaleString()} | Còn: ${c.remaining.toLocaleString()} VND${c.overdue > 0 ? ` | ${c.overdue} quá hạn` : ''}`)
        .join('\n');
    }
    case 'get_payable_details': {
      const payables = await prisma.payable.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        include: { supplier: { select: { company_name: true } } },
        orderBy: { remaining: 'desc' },
      });
      const bySupplier = new Map<string, any>();
      for (const p of payables) {
        const name = p.supplier?.company_name || 'N/A';
        const e = bySupplier.get(p.supplier_id) || { id: p.supplier_id, name, total: 0, paid: 0, remaining: 0, count: 0, overdue: 0 };
        e.total += Number(p.original_amount); e.paid += Number(p.paid_amount); e.remaining += Number(p.remaining); e.count++; if (p.status === 'OVERDUE') e.overdue++;
        bySupplier.set(p.supplier_id, e);
      }
      return Array.from(bySupplier.values()).sort((a, b) => b.remaining - a.remaining)
        .map((s, i) => `${i + 1}. ${s.name} [id:${s.id}] | ${s.count} HĐ | Gốc: ${s.total.toLocaleString()} | Đã trả: ${s.paid.toLocaleString()} | Còn: ${s.remaining.toLocaleString()} VND${s.overdue > 0 ? ` | ${s.overdue} quá hạn` : ''}`)
        .join('\n');
    }
    case 'get_customer_list': {
      const customers = await prisma.customer.findMany({
        where: { is_active: true },
        include: { _count: { select: { sales_orders: true } }, receivables: { select: { remaining: true, status: true } }, sales_orders: { select: { grand_total: true }, take: 100 } },
      });
      return customers.map((c, i) => {
        const debt = c.receivables.reduce((s, r) => s + Number(r.remaining), 0);
        const rev = c.sales_orders.reduce((s, o) => s + Number(o.grand_total), 0);
        const overdue = c.receivables.filter(r => r.status === 'OVERDUE').length;
        return `${i + 1}. ${c.company_name || c.contact_name} [id:${c.id}] | SĐT: ${c.phone || '-'} | ${c._count.sales_orders} đơn | DT: ${rev.toLocaleString()} | Nợ: ${debt.toLocaleString()} VND${overdue > 0 ? ` | ${overdue} QH` : ''}`;
      }).join('\n');
    }
    case 'get_supplier_list': {
      const suppliers = await prisma.supplier.findMany({
        where: { is_active: true },
        include: { _count: { select: { purchase_orders: true } }, payables: { select: { remaining: true, status: true } } },
      });
      return suppliers.map((s, i) => {
        const debt = s.payables.reduce((sum, p) => sum + Number(p.remaining), 0);
        const overdue = s.payables.filter(p => p.status === 'OVERDUE').length;
        return `${i + 1}. ${s.company_name} [id:${s.id}] | SĐT: ${s.phone || '-'} | ${s._count.purchase_orders} PO | Nợ: ${debt.toLocaleString()} VND${overdue > 0 ? ` | ${overdue} QH` : ''}`;
      }).join('\n');
    }
    case 'get_product_list': {
      const products = await prisma.product.findMany({ where: { is_active: true }, select: { sku: true, name: true, retail_price: true, material: true, capacity_ml: true } });
      return products.map((p, i) => `${i + 1}. ${p.sku} | ${p.name} | ${p.material || '-'} | ${p.capacity_ml ? p.capacity_ml + 'ml' : '-'} | Giá tham khảo: ${p.retail_price ? Number(p.retail_price).toLocaleString() : '-'}`).join('\n');
    }
    case 'get_financial_report': {
      const [soRev, poCost, cashExp] = await Promise.all([
        prisma.salesOrder.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { grand_total: true } }),
        prisma.purchaseOrder.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { total: true } }),
        prisma.cashTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } }),
      ]);
      const rev = Number(soRev._sum.grand_total || 0), cost = Number(poCost._sum.total || 0), opex = Number(cashExp._sum.amount || 0);
      return `Doanh thu (SO): ${rev.toLocaleString()} VND\nGiá vốn (PO): ${cost.toLocaleString()} VND\nLợi nhuận gộp: ${(rev - cost).toLocaleString()} VND\nChi phí vận hành: ${opex.toLocaleString()} VND\nLợi nhuận ròng: ${(rev - cost - opex).toLocaleString()} VND`;
    }
    case 'get_cash_book_details': {
      const cats = await prisma.cashCategory.findMany({ include: { transactions: { select: { amount: true } } }, orderBy: { type: 'asc' } });
      return cats.filter(c => c.transactions.length > 0).map(c => {
        const total = c.transactions.reduce((s, t) => s + Number(t.amount), 0);
        return `[${c.type}] ${c.name}: ${total.toLocaleString()} VND (${c.transactions.length} GD)`;
      }).join('\n');
    }
    case 'get_recent_orders': {
      const limit = args.limit || 15;
      const orders = await prisma.salesOrder.findMany({
        orderBy: { created_at: 'desc' }, take: limit,
        include: { customer: { select: { company_name: true, contact_name: true } }, items: { select: { quantity: true, unit_price: true, product: { select: { name: true, sku: true } } } } },
      });
      return orders.map((o, i) => {
        const items = o.items.map(it => `  └ ${it.product?.sku} ${it.product?.name} x${it.quantity} @ ${Number(it.unit_price).toLocaleString()}`).join('\n');
        return `${i + 1}. ${o.order_code} | ${o.customer?.company_name || o.customer?.contact_name} | ${Number(o.grand_total).toLocaleString()} VND | ${o.status}\n${items}`;
      }).join('\n');
    }
    case 'get_return_details': {
      const [sr, pr] = await Promise.all([
        prisma.salesReturn.findMany({ take: 10, orderBy: { created_at: 'desc' }, include: { customer: { select: { company_name: true, contact_name: true } }, items: { include: { product: { select: { name: true } } } } } }),
        prisma.purchaseReturn.findMany({ take: 10, orderBy: { created_at: 'desc' }, include: { supplier: { select: { company_name: true } }, items: { include: { product: { select: { name: true } } } } } }),
      ]);
      let result = 'TRẢ HÀNG BÁN:\n';
      sr.forEach((r, i) => { result += `${i + 1}. ${r.return_code} | ${r.customer?.company_name || r.customer?.contact_name} | ${Number(r.total_amount).toLocaleString()} VND | ${r.status}\n`; });
      result += '\nTRẢ HÀNG MUA:\n';
      pr.forEach((r, i) => { result += `${i + 1}. ${r.return_code} | ${r.supplier?.company_name} | ${Number(r.total_amount).toLocaleString()} VND | ${r.status}\n`; });
      return result;
    }
    case 'search_customer': {
      const q = args.query || '';
      const customers = await prisma.customer.findMany({
        where: { OR: [{ company_name: { contains: q, mode: 'insensitive' } }, { contact_name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
        include: { _count: { select: { sales_orders: true } }, receivables: { select: { remaining: true, status: true } } }, take: 10,
      });
      if (customers.length === 0) return 'Không tìm thấy khách hàng nào.';
      return customers.map((c, i) => {
        const debt = c.receivables.reduce((s, r) => s + Number(r.remaining), 0);
        const zalo = c.zalo_user_id ? ` | Zalo ID: ${c.zalo_user_id}` : '';
        return `${i + 1}. ${c.company_name || c.contact_name} [id:${c.id}] | SĐT: ${c.phone || '-'}${zalo} | ${c._count.sales_orders} đơn | Nợ: ${debt.toLocaleString()} VND`;
      }).join('\n');
    }
    case 'get_order_detail': {
      const order = await prisma.salesOrder.findFirst({
        where: { order_code: { contains: args.order_code, mode: 'insensitive' } },
        include: { customer: true, items: { include: { product: { select: { name: true, sku: true } } } }, purchase_orders: { include: { supplier: { select: { company_name: true } } } } },
      });
      if (!order) return 'Không tìm thấy đơn hàng.';
      let result = `Mã: ${order.order_code}\nKH: ${order.customer?.company_name || order.customer?.contact_name}\nNgày: ${dayjs(order.order_date).format('DD/MM/YYYY')}\nTổng: ${Number(order.grand_total).toLocaleString()} VND\nTT: ${order.status}\n\nSản phẩm:\n`;
      order.items.forEach(it => { result += `• ${it.product?.sku} ${it.product?.name} x${it.quantity} @ ${Number(it.unit_price).toLocaleString()} = ${Number(it.line_total).toLocaleString()} VND\n`; });
      if (order.purchase_orders.length > 0) {
        result += '\nĐơn mua liên kết:\n';
        order.purchase_orders.forEach(po => { result += `• ${po.order_code} | ${po.supplier?.company_name} | ${Number(po.total).toLocaleString()} VND | ${po.status}\n`; });
      }
      return `${result}[id:${order.id}]`;
    }
    case 'search_supplier': {
      const q = args.query || '';
      const suppliers = await prisma.supplier.findMany({
        where: { OR: [{ company_name: { contains: q, mode: 'insensitive' } }, { contact_name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
        take: 10,
      });
      if (suppliers.length === 0) return 'Không tìm thấy NCC.';
      return suppliers.map((s, i) => {
        const zalo = s.zalo_user_id ? ` | Zalo ID: ${s.zalo_user_id}` : '';
        return `${i + 1}. ${s.company_name} [id:${s.id}] | SĐT: ${s.phone || '-'}${zalo}`;
      }).join('\n');
    }
    case 'search_product': {
      const q = args.query || '';
      const products = await prisma.product.findMany({
        where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] },
        take: 10,
      });
      if (products.length === 0) return 'Không tìm thấy SP.';
      return products.map((p, i) => `${i + 1}. ${p.name} (${p.sku}) [id:${p.id}] | Giá tham khảo: ${p.retail_price ? Number(p.retail_price).toLocaleString() : '-'}`).join('\n');
    }
    case 'find_product_by_image': {
      // Backward compat: accept legacy single image_url or new image_urls array
      let imageUrls: string[] = [];
      if (Array.isArray(args.image_urls)) {
        imageUrls = args.image_urls.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0);
      } else if (typeof args.image_url === 'string' && args.image_url) {
        imageUrls = [args.image_url];
      }
      if (imageUrls.length === 0) return '⚠️ Thiếu image_urls.';
      const attrs = await ChatbotService.identifyProductFromImage(imageUrls);
      const { ProductService } = await import('../product/product.service');

      // Helper: build one product-card JSON entry from product record
      const toCard = (p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        material: p.material ?? undefined,
        capacity_ml: p.capacity_ml ?? undefined,
        price: p.retail_price != null ? Number(p.retail_price) : undefined,
        image: p.images?.[0]?.url ?? undefined,
        moq: p.moq ?? undefined,
      });

      // Ưu tiên direct lookup nếu OCR được SKU trên nhãn
      if (attrs.sku_tu_nhan && attrs.sku_tu_nhan.trim()) {
        const skuRaw = attrs.sku_tu_nhan.trim();
        const skuMatch = await prisma.product.findFirst({
          where: {
            OR: [
              { sku: { equals: skuRaw, mode: 'insensitive' } },
              { sku: { contains: skuRaw, mode: 'insensitive' } },
            ],
          },
          include: { images: { where: { is_primary: true }, take: 1 } },
        });
        if (skuMatch) {
          const specs: string[] = [];
          if ((skuMatch as any).capacity_ml) specs.push(`${(skuMatch as any).capacity_ml}ml`);
          if ((skuMatch as any).material) specs.push((skuMatch as any).material);
          const specStr = specs.length ? ` (${specs.join(', ')})` : '';
          const price = (skuMatch as any).retail_price ? ` | ~${Number((skuMatch as any).retail_price).toLocaleString()}đ` : '';
          const header = `Nhận diện ảnh → SKU trên nhãn: ${skuRaw} (match trực tiếp)`;
          const cardBlock = `<product-cards>\n${JSON.stringify([toCard(skuMatch)])}\n</product-cards>`;
          return [cardBlock, header, 'Top match:', `1. ${skuMatch.name}${specStr} · SKU ${skuMatch.sku} [id:${skuMatch.id}]${price}`].join('\n');
        }
      }

      const products = await ProductService.fuzzyMatchByAttributes(attrs);
      if (products.length === 0) return `Nhận diện: ${JSON.stringify(attrs)}\nKhông có sản phẩm match trong DB.`;
      const header = `Nhận diện ảnh → loại=${attrs.loai ?? '?'} chất_liệu=${attrs.chat_lieu ?? '?'} dung_tích=${attrs.dung_tich_ml ?? '?'}ml${attrs.brand ? ` brand=${attrs.brand}` : ''}${attrs.sku_tu_nhan ? ` sku_nhãn=${attrs.sku_tu_nhan}` : ''} (confidence ${attrs.confidence})`;
      const rows = products.map((p: any, i: number) => {
        const specs: string[] = [];
        if (p.capacity_ml) specs.push(`${p.capacity_ml}ml`);
        if (p.material) specs.push(p.material);
        const specStr = specs.length ? ` (${specs.join(', ')})` : '';
        const price = p.retail_price ? ` | ~${Number(p.retail_price).toLocaleString()}đ` : '';
        return `${i + 1}. ${p.name}${specStr} · SKU ${p.sku} [id:${p.id}]${price}`;
      });
      const cards = products.slice(0, 5).map(toCard);
      const cardBlock = `<product-cards>\n${JSON.stringify(cards)}\n</product-cards>`;
      return [cardBlock, header, 'Top match:', ...rows].join('\n');
    }
    case 'create_customer': {
      const c = await prisma.customer.create({
        data: {
          company_name: args.company_name,
          phone: args.phone || null, email: args.email || null, contact_name: args.contact_name || null,
          address: args.address || null, customer_type: args.customer_type || 'INDIVIDUAL',
          tax_code: args.tax_code || null, debt_limit: args.debt_limit || 0,
          approval_status: 'APPROVED',
        },
      });
      return `✅ Đã tạo KH "${c.company_name}" [id:${c.id}]`;
    }
    case 'update_customer': {
      const { id, ...data } = args;
      const c = await prisma.customer.update({ where: { id }, data });
      return `✅ Đã cập nhật KH "${c.company_name}" [id:${c.id}]`;
    }
    case 'create_supplier': {
      const s = await prisma.supplier.create({
        data: {
          company_name: args.company_name,
          contact_name: args.contact_name || null, phone: args.phone || null, email: args.email || null,
          address: args.address || null, tax_code: args.tax_code || null,
          payment_terms: args.payment_terms || 'NET_30',
        },
      });
      return `✅ Đã tạo NCC "${s.company_name}" [id:${s.id}]`;
    }
    case 'update_supplier': {
      const { id, ...data } = args;
      const s = await prisma.supplier.update({ where: { id }, data });
      return `✅ Đã cập nhật NCC "${s.company_name}" [id:${s.id}]`;
    }
    case 'create_product': {
      const sku = args.sku || `SP-${Date.now().toString(36).toUpperCase()}`;
      const p = await prisma.product.create({
        data: {
          name: args.name, sku,
          material: args.material || null, capacity_ml: args.capacity_ml || null,
          retail_price: args.retail_price || null,
          moq: args.moq || null, category_id: args.category_id || null,
          description: args.description || null,
        },
      });
      return `✅ Đã tạo SP "${p.name}" (${p.sku}) [id:${p.id}]`;
    }
    case 'update_product': {
      const { id, ...data } = args;
      const p = await prisma.product.update({ where: { id }, data });
      return `✅ Đã cập nhật SP "${p.name}" [id:${p.id}]`;
    }
    case 'create_sales_order': {
      const { SalesOrderService } = await import('../sales-order/sales-order.service');
      const order = await SalesOrderService.create({
        customer_id: args.customer_id,
        expected_delivery: args.expected_delivery,
        notes: args.notes,
        vat_rate: args.vat_rate || 'VAT_0',
        items: args.items,
      });
      return `✅ Đã tạo đơn bán ${order.order_code} [id:${order.id}] — Tổng: ${Number(order.grand_total).toLocaleString()} VND`;
    }
    case 'update_sales_order_status': {
      const o = await prisma.salesOrder.update({ where: { id: args.id }, data: { status: args.status } });
      return `✅ Đơn ${o.order_code} → ${args.status} [id:${o.id}]`;
    }
    case 'update_sales_order': {
      const { SalesOrderService } = await import('../sales-order/sales-order.service');
      const { id, ...data } = args;
      const o = await SalesOrderService.update(id, data);
      return `✅ Đã cập nhật đơn bán ${o.order_code} [id:${o.id}] — Tổng: ${Number(o.grand_total).toLocaleString()} VND`;
    }
    case 'add_sales_order_item': {
      const { SalesOrderService } = await import('../sales-order/sales-order.service');
      const item = await SalesOrderService.addItem(args.sales_order_id, {
        product_id: args.product_id, quantity: args.quantity, unit_price: args.unit_price,
        supplier_id: args.supplier_id, customer_product_name: args.customer_product_name,
      });
      return `✅ Đã thêm SP vào đơn. Line total: ${Number(item.line_total).toLocaleString()} VND`;
    }
    case 'create_purchase_order': {
      const { PurchaseOrderService } = await import('../purchase-order/purchase-order.service');
      const po = await PurchaseOrderService.create({
        supplier_id: args.supplier_id, sales_order_id: args.sales_order_id,
        expected_delivery: args.expected_delivery, notes: args.notes, items: args.items,
      });
      return `✅ Đã tạo đơn mua ${po.order_code} [id:${po.id}] — Tổng: ${Number(po.total).toLocaleString()} VND`;
    }
    case 'update_purchase_order_status': {
      const p = await prisma.purchaseOrder.update({ where: { id: args.id }, data: { status: args.status } });
      return `✅ PO ${p.order_code} → ${args.status} [id:${p.id}]`;
    }
    case 'update_purchase_order': {
      const { PurchaseOrderService } = await import('../purchase-order/purchase-order.service');
      const { id, ...data } = args;
      const p = await PurchaseOrderService.update(id, data);
      return `✅ Đã cập nhật đơn mua ${p.order_code} [id:${p.id}] — Tổng: ${Number(p.total).toLocaleString()} VND`;
    }
    case 'record_receivable_payment': {
      const { ReceivableService } = await import('../receivable/receivable.service');
      const pay = await ReceivableService.recordPayment({
        customer_id: args.customer_id, amount: args.amount,
        payment_date: args.payment_date, method: args.method,
        reference: args.reference, evidence_url: args.evidence_url,
      });
      return `✅ Đã ghi nhận thu ${Number(args.amount).toLocaleString()} VND từ KH. Phân bổ ${(pay as any).allocations?.length || 0} HĐ.`;
    }
    case 'record_payable_payment': {
      const { PayableService } = await import('../payable/payable.service');
      const pay = await PayableService.recordPayment({
        supplier_id: args.supplier_id, amount: args.amount,
        payment_date: args.payment_date, method: args.method,
        reference: args.reference, evidence_url: args.evidence_url,
      });
      return `✅ Đã ghi nhận trả ${Number(args.amount).toLocaleString()} VND cho NCC. Phân bổ ${(pay as any).allocations?.length || 0} HĐ.`;
    }
    case 'create_cash_transaction': {
      const ct = await prisma.cashTransaction.create({
        data: {
          type: args.type, amount: args.amount, category_id: args.category_id,
          date: new Date(args.transaction_date),
          description: args.description || '', reference: args.reference || null,
        },
      });
      return `✅ Đã ghi ${args.type === 'INCOME' ? 'thu' : 'chi'} ${Number(args.amount).toLocaleString()} VND [id:${ct.id}]`;
    }
    case 'create_operating_cost': {
      const c = await prisma.operatingCost.create({
        data: {
          category_id: args.category_id, amount: args.amount,
          date: new Date(args.date), description: args.description || null,
        },
      });
      return `✅ Đã thêm chi phí vận hành ${Number(args.amount).toLocaleString()} VND [id:${c.id}]`;
    }
    case 'upsert_customer_product_price': {
      const p = await prisma.customerProductPrice.upsert({
        where: { customer_id_product_id: { customer_id: args.customer_id, product_id: args.product_id } },
        update: { price: args.price },
        create: { customer_id: args.customer_id, product_id: args.product_id, price: args.price },
      });
      return `✅ Đã lưu giá ${Number(args.price).toLocaleString()} VND cho KH này + SP này [id:${p.id}]`;
    }
    case 'upsert_supplier_price': {
      const existing = await prisma.supplierPrice.findUnique({
        where: { supplier_id_product_id: { supplier_id: args.supplier_id, product_id: args.product_id } },
      });
      if (args.is_preferred) {
        await prisma.supplierPrice.updateMany({ where: { product_id: args.product_id, is_preferred: true }, data: { is_preferred: false } });
      }
      const p = existing
        ? await prisma.supplierPrice.update({ where: { id: existing.id }, data: { purchase_price: args.purchase_price, moq: args.moq, lead_time_days: args.lead_time_days, is_preferred: args.is_preferred } })
        : await prisma.supplierPrice.create({ data: { supplier_id: args.supplier_id, product_id: args.product_id, purchase_price: args.purchase_price, moq: args.moq, lead_time_days: args.lead_time_days, is_preferred: args.is_preferred || false } });
      return `✅ Đã lưu giá NCC ${Number(args.purchase_price).toLocaleString()} VND [id:${p.id}]`;
    }
    case 'list_categories': {
      if (args.type === 'product') {
        const cats = await prisma.category.findMany({ orderBy: { name: 'asc' } });
        return cats.map((c) => `• ${c.name} [id:${c.id}]`).join('\n') || 'Chưa có danh mục';
      }
      if (args.type === 'cash') {
        const cats = await prisma.cashCategory.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
        return cats.map((c) => `• [${c.type}] ${c.name} [id:${c.id}]`).join('\n') || 'Chưa có danh mục';
      }
      if (args.type === 'operating_cost') {
        const cats = await prisma.operatingCostCategory.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
        return cats.map((c) => `• ${c.name} [id:${c.id}]`).join('\n') || 'Chưa có danh mục';
      }
      return 'type không hợp lệ';
    }
    // ─── Invoice ───
    case 'create_sales_invoice': {
      const { InvoiceService } = await import('../invoice/invoice.service');
      const inv = await InvoiceService.createFromOrder(args.sales_order_id);
      return `✅ Đã tạo hóa đơn ${inv.invoice_number} [id:${inv.id}] · status: ${inv.status}`;
    }
    case 'create_purchase_invoice': {
      const { InvoiceService } = await import('../invoice/invoice.service');
      const inv = await InvoiceService.createPurchaseInvoice(args.purchase_order_id);
      if (args.notes) {
        await InvoiceService.updateInvoice(inv.id, { notes: args.notes });
      }
      return `✅ Đã tạo hóa đơn mua #${inv.invoice_number} [id:${inv.id}] · status: ${inv.status}`;
    }
    case 'update_sales_invoice': {
      const { InvoiceService } = await import('../invoice/invoice.service');
      const { id, invoice_date, ...rest } = args;
      const data: Record<string, unknown> = { ...rest };
      if (invoice_date) data.invoice_date = new Date(invoice_date);
      const inv = await InvoiceService.updateInvoice(id, data);
      return `✅ Đã cập nhật hóa đơn #${inv.invoice_number} [id:${inv.id}]`;
    }
    case 'finalize_invoice': {
      const { InvoiceService } = await import('../invoice/invoice.service');
      const inv = await InvoiceService.finalize(args.invoice_id);
      return `✅ Đã duyệt HĐ ${inv.invoice_number} [id:${inv.id}]`;
    }
    case 'cancel_invoice': {
      const { InvoiceService } = await import('../invoice/invoice.service');
      const inv = await InvoiceService.cancel(args.invoice_id);
      return `✅ Đã hủy HĐ ${inv.invoice_number} [id:${inv.id}]`;
    }
    // ─── Return ───
    case 'create_sales_return': {
      const { SalesReturnService } = await import('../return/sales-return.service');
      const r = await SalesReturnService.create(args as any);
      return `✅ Đã tạo phiếu trả hàng bán ${r.return_code} [id:${r.id}]`;
    }
    case 'create_purchase_return': {
      const { PurchaseReturnService } = await import('../return/purchase-return.service');
      const r = await PurchaseReturnService.create(args as any);
      return `✅ Đã tạo phiếu trả hàng mua ${r.return_code} [id:${r.id}]`;
    }
    // ─── Soft delete ───
    case 'delete_customer': {
      const { CustomerService } = await import('../customer/customer.service');
      await CustomerService.softDelete(args.id);
      return `✅ Đã xóa khách hàng [id:${args.id}]`;
    }
    case 'delete_supplier': {
      const { SupplierService } = await import('../supplier/supplier.service');
      await SupplierService.softDelete(args.id);
      return `✅ Đã xóa NCC [id:${args.id}]`;
    }
    case 'delete_product': {
      const { ProductService } = await import('../product/product.service');
      await ProductService.softDelete(args.id);
      return `✅ Đã xóa sản phẩm [id:${args.id}]`;
    }
    case 'remove_sales_order_item': {
      const { SalesOrderService } = await import('../sales-order/sales-order.service');
      await SalesOrderService.removeItem(args.sales_order_id, args.item_id);
      return `✅ Đã gỡ item khỏi đơn bán [id:${args.sales_order_id}]`;
    }
    // ─── Create category ───
    case 'create_product_category': {
      const c = await prisma.category.create({ data: { name: args.name } });
      return `✅ Đã tạo danh mục SP "${c.name}" [id:${c.id}]`;
    }
    case 'create_cash_category': {
      const { CashBookService } = await import('../cash-book/cash-book.service');
      const c = await CashBookService.createCategory({ name: args.name, type: args.type });
      return `✅ Đã tạo danh mục sổ quỹ [${c.type}] "${c.name}" [id:${c.id}]`;
    }
    case 'create_operating_cost_category': {
      const { OperatingCostService } = await import('../operating-cost/operating-cost.service');
      const c = await OperatingCostService.createCategory(args.name);
      return `✅ Đã tạo danh mục chi phí VH "${c.name}" [id:${c.id}]`;
    }
    // ─── Payroll ───
    case 'create_payroll_period': {
      const { PayrollService } = await import('../payroll/payroll.service');
      const p = await PayrollService.createPeriod(Number(args.year), Number(args.month));
      return `✅ Đã tạo kỳ lương ${args.month}/${args.year} [id:${p.id}]`;
    }
    case 'calculate_payroll': {
      const { PayrollService } = await import('../payroll/payroll.service');
      const r = await PayrollService.calculatePeriod(args.period_id);
      return `✅ Đã tính lương kỳ [id:${args.period_id}] — ${r.calculated} nhân viên`;
    }
    case 'approve_payroll': {
      const { PayrollService } = await import('../payroll/payroll.service');
      await PayrollService.approvePeriod(args.period_id, 'chatbot');
      return `✅ Đã duyệt kỳ lương [id:${args.period_id}]`;
    }
    case 'mark_payroll_paid': {
      const { PayrollService } = await import('../payroll/payroll.service');
      await PayrollService.markPaid(args.period_id);
      return `✅ Đã đánh dấu kỳ lương đã trả [id:${args.period_id}]`;
    }
    // ─── Alerts ───
    case 'mark_alert_read': {
      const { AlertService } = await import('../alert/alert.service');
      await AlertService.markAsRead(args.alert_id);
      return `✅ Đã đánh dấu alert đã đọc [id:${args.alert_id}]`;
    }
    case 'take_alert_action': {
      const { AlertService } = await import('../alert/alert.service');
      await AlertService.takeAction(args.alert_id, args.action, args.new_expected_date);
      return `✅ Đã ghi nhận action "${args.action}" cho alert [id:${args.alert_id}]`;
    }
    // ─── Cash / Operating cost edits ───
    case 'update_cash_transaction': {
      const { CashBookService } = await import('../cash-book/cash-book.service');
      const { id, transaction_date, ...rest } = args;
      const data: Record<string, any> = { ...rest };
      if (transaction_date) data.date = transaction_date;
      const ct = await CashBookService.update(id, data);
      return `✓ Đã cập nhật giao dịch sổ quỹ ${Number(ct.amount).toLocaleString()} VND [id:${ct.id}]`;
    }
    case 'delete_cash_transaction': {
      const { CashBookService } = await import('../cash-book/cash-book.service');
      await CashBookService.delete(args.id);
      return `✓ Đã xoá giao dịch sổ quỹ [id:${args.id}]`;
    }
    case 'update_operating_cost': {
      const { OperatingCostService } = await import('../operating-cost/operating-cost.service');
      const { id, cost_date, ...rest } = args;
      const data: Record<string, any> = { ...rest };
      if (cost_date) data.date = cost_date;
      const c = await OperatingCostService.update(id, data);
      return `✓ Đã cập nhật chi phí vận hành ${Number(c.amount).toLocaleString()} VND [id:${c.id}]`;
    }
    case 'delete_operating_cost': {
      const { OperatingCostService } = await import('../operating-cost/operating-cost.service');
      await OperatingCostService.delete(args.id);
      return `✓ Đã xoá chi phí vận hành [id:${args.id}]`;
    }
    // ─── Payment evidence ───
    case 'update_receivable_payment_evidence': {
      const { ReceivableService } = await import('../receivable/receivable.service');
      const r = await ReceivableService.updatePaymentEvidence(args.payment_id, args.evidence_url);
      return `✓ Đã cập nhật minh chứng payment phải thu [id:${r.id}]`;
    }
    case 'update_payable_payment_evidence': {
      const { PayableService } = await import('../payable/payable.service');
      const r = await PayableService.updatePaymentEvidence(args.payment_id, args.evidence_url);
      return `✓ Đã cập nhật minh chứng payment phải trả [id:${r.id}]`;
    }
    // ─── Price deletions ───
    case 'delete_customer_product_price': {
      const { CustomerProductPriceService } = await import('../customer-product-price/customer-product-price.service');
      await CustomerProductPriceService.delete(args.id);
      return `✓ Đã xoá giá KH cho SP [id:${args.id}]`;
    }
    case 'delete_supplier_price': {
      const { SupplierPriceService } = await import('../supplier-price/supplier-price.service');
      await SupplierPriceService.delete(args.id);
      return `✓ Đã xoá giá NCC cho SP [id:${args.id}]`;
    }
    // ─── Update / Delete return ───
    case 'update_sales_return': {
      const data: Record<string, any> = {};
      if (args.reason !== undefined) data.reason = args.reason;
      if (args.notes !== undefined) data.notes = args.notes;
      if (Object.keys(data).length === 0) return '⚠️ Không có trường nào để cập nhật.';
      const r = await prisma.salesReturn.update({ where: { id: args.id }, data });
      return `✅ Đã cập nhật phiếu trả bán ${r.return_code} [id:${r.id}]`;
    }
    case 'delete_sales_return': {
      const { SalesReturnService } = await import('../return/sales-return.service');
      await SalesReturnService.delete(args.id);
      return `✅ Đã xoá phiếu trả hàng bán [id:${args.id}]`;
    }
    case 'update_purchase_return': {
      const data: Record<string, any> = {};
      if (args.reason !== undefined) data.reason = args.reason;
      if (args.notes !== undefined) data.notes = args.notes;
      if (Object.keys(data).length === 0) return '⚠️ Không có trường nào để cập nhật.';
      const r = await prisma.purchaseReturn.update({ where: { id: args.id }, data });
      return `✅ Đã cập nhật phiếu trả mua ${r.return_code} [id:${r.id}]`;
    }
    case 'delete_purchase_return': {
      const { PurchaseReturnService } = await import('../return/purchase-return.service');
      await PurchaseReturnService.delete(args.id);
      return `✅ Đã xoá phiếu trả hàng mua [id:${args.id}]`;
    }
    // ─── Employee profile ───
    case 'create_employee_profile': {
      const { PayrollService } = await import('../payroll/payroll.service');
      const p = await PayrollService.createEmployee(args);
      return `✅ Đã tạo hồ sơ NV "${(p as any).user?.full_name || ''}" [id:${p.id}]`;
    }
    case 'update_employee_profile': {
      const { PayrollService } = await import('../payroll/payroll.service');
      const { id, ...data } = args;
      if (data.join_date) data.join_date = new Date(data.join_date);
      const p = await PayrollService.updateEmployee(id, data);
      return `✅ Đã cập nhật hồ sơ NV "${(p as any).user?.full_name || ''}" [id:${p.id}]`;
    }
    case 'delete_employee_profile': {
      const p = await prisma.employeeProfile.update({
        where: { id: args.id },
        data: { employment_status: 'INACTIVE' },
      });
      return `✅ Đã đánh dấu NV nghỉ việc (INACTIVE) [id:${p.id}]`;
    }
    // ─── Update / Delete category ───
    case 'update_product_category': {
      const c = await prisma.category.update({ where: { id: args.id }, data: { name: args.name } });
      return `✅ Đã đổi tên danh mục SP → "${c.name}" [id:${c.id}]`;
    }
    case 'delete_product_category': {
      const c = await prisma.category.update({ where: { id: args.id }, data: { is_active: false } });
      return `✅ Đã xoá danh mục SP "${c.name}" [id:${c.id}]`;
    }
    case 'update_cash_category': {
      const { CashBookService } = await import('../cash-book/cash-book.service');
      const data: { name?: string; is_active?: boolean } = {};
      if (args.name !== undefined) data.name = args.name;
      if (args.is_active !== undefined) data.is_active = args.is_active;
      if (Object.keys(data).length === 0) return '⚠️ Không có trường nào để cập nhật.';
      const c = await CashBookService.updateCategory(args.id, data);
      return `✅ Đã cập nhật danh mục sổ quỹ [${c.type}] "${c.name}" [id:${c.id}]`;
    }
    case 'delete_cash_category': {
      const { CashBookService } = await import('../cash-book/cash-book.service');
      const c = await CashBookService.updateCategory(args.id, { is_active: false });
      return `✅ Đã xoá danh mục sổ quỹ "${c.name}" [id:${c.id}]`;
    }
    case 'update_operating_cost_category': {
      const { OperatingCostService } = await import('../operating-cost/operating-cost.service');
      const c = await OperatingCostService.updateCategory(args.id, args.name);
      return `✅ Đã đổi tên danh mục chi phí VH → "${c.name}" [id:${c.id}]`;
    }
    case 'delete_operating_cost_category': {
      const c = await prisma.operatingCostCategory.update({
        where: { id: args.id },
        data: { is_active: false },
      });
      return `✅ Đã xoá danh mục chi phí VH "${c.name}" [id:${c.id}]`;
    }
    // ─── Zalo tools ───
    case 'get_zalo_messages': {
      const now = dayjs();
      let start: dayjs.Dayjs | null = null;
      let end: dayjs.Dayjs | null = null;
      switch (args.range || 'today') {
        case 'today':     start = now.startOf('day');       end = now.endOf('day'); break;
        case 'yesterday': start = now.subtract(1, 'day').startOf('day'); end = now.subtract(1, 'day').endOf('day'); break;
        case 'week':      start = now.startOf('week');      end = now.endOf('week'); break;
        case 'month':     start = now.startOf('month');     end = now.endOf('month'); break;
        case 'all':       break;
        case 'custom':
          if (args.from_date) start = dayjs(args.from_date).startOf('day');
          if (args.to_date)   end = dayjs(args.to_date).endOf('day');
          break;
      }
      const where: any = {};
      if (start) where.created_at = { gte: start.toDate() };
      if (end)   where.created_at = { ...(where.created_at || {}), lte: end.toDate() };
      if (args.sender_id) where.sender_id = args.sender_id;
      if (args.group_id)  where.group_id = args.group_id;
      if (args.direction && args.direction !== 'ALL') where.direction = args.direction;
      if (args.search) {
        where.OR = [
          { sender_name: { contains: args.search, mode: 'insensitive' } },
          { content: { contains: args.search, mode: 'insensitive' } },
        ];
      }
      const limit = Math.min(args.limit ?? 100, 300);
      const msgs = await prisma.zaloMessage.findMany({
        where, orderBy: { created_at: 'desc' }, take: limit,
        select: { id: true, direction: true, sender_id: true, sender_name: true, group_id: true, content: true, msg_type: true, created_at: true },
      });
      if (msgs.length === 0) {
        return args.search
          ? `Không tìm thấy tin nhắn nào khớp "${args.search}".`
          : 'Không có tin nhắn Zalo nào trong khoảng này.';
      }
      return msgs.reverse().map((m) => {
        const t = dayjs(m.created_at).format('DD/MM HH:mm');
        const who = m.direction === 'OUTGOING' ? '→ shop' : `← ${m.sender_name || m.sender_id?.slice(0, 8) || '?'}`;
        const loc = m.group_id ? ` [group:${m.group_id.slice(0, 8)}]` : '';
        const content = (m.content || '').replace(/\n/g, ' ').slice(0, 280);
        return `${t} ${who}${loc}: ${content}`;
      }).join('\n');
    }
    case 'list_zalo_threads': {
      const sinceDays = args.since_days ?? 30;
      const since = dayjs().subtract(sinceDays, 'day').toDate();
      const where: any = { created_at: { gte: since } };
      if (args.type === 'user')  where.group_id = null;
      if (args.type === 'group') where.group_id = { not: null };
      if (args.search) {
        where.sender_name = { contains: args.search, mode: 'insensitive' };
      }
      const msgs = await prisma.zaloMessage.findMany({
        where, orderBy: { created_at: 'desc' },
        select: { sender_id: true, sender_name: true, recipient_id: true, group_id: true, direction: true, content: true, created_at: true },
      });
      // Partner = conversation counterpart (NOT the shop itself).
      // For group: key = group_id.
      // For DM INCOMING: partner = sender_id (customer who wrote to us).
      // For DM OUTGOING: partner = recipient_id (customer we wrote to).
      // sender_name on both directions tends to be the partner's display name (webhook behavior).
      const threads = new Map<string, { key: string; name: string; is_group: boolean; last_at: Date; last_content: string; last_direction: string; incoming: number; total: number }>();
      for (const m of msgs) {
        const key = m.group_id
          ? m.group_id
          : (m.direction === 'INCOMING' ? m.sender_id : (m.recipient_id || m.sender_id));
        if (!key) continue;
        if (!threads.has(key)) {
          threads.set(key, {
            key,
            name: m.sender_name || (m.group_id ? `Group ${key.slice(0, 8)}` : `User ${key.slice(0, 8)}`),
            is_group: Boolean(m.group_id),
            last_at: m.created_at,
            last_content: m.content || '',
            last_direction: m.direction,
            incoming: 0,
            total: 0,
          });
        }
        const t = threads.get(key)!;
        t.total++;
        if (m.direction === 'INCOMING') t.incoming++;
      }
      const limit = args.limit ?? 20;
      const list = [...threads.values()].sort((a, b) => b.last_at.getTime() - a.last_at.getTime()).slice(0, limit);
      if (list.length === 0) {
        return args.search
          ? `Không tìm thấy thread Zalo nào có tên chứa "${args.search}" trong ${sinceDays} ngày qua.`
          : `Không có thread Zalo hoạt động trong ${sinceDays} ngày qua.`;
      }
      return list.map((t, i) => {
        const dir = t.last_direction === 'OUTGOING' ? '→' : '←';
        const time = dayjs(t.last_at).format('DD/MM HH:mm');
        const tag = t.is_group ? '[GROUP]' : '[DM]';
        return `${i + 1}. ${tag} ${t.name} [key:${t.key}] | ${t.total} tin (${t.incoming} đến) | ${time} ${dir} ${(t.last_content || '').slice(0, 80)}`;
      }).join('\n');
    }
    case 'send_zalo_message': {
      if (!args.user_id || !args.content) return '❌ Thiếu user_id hoặc content';
      // Sanity check: user_id must be the PARTNER's id, not the shop's own id.
      // Shop's id appears as sender_id on OUTGOING webhook echoes. If the provided
      // user_id only appears as sender on OUTGOING (never on INCOMING), it's the shop.
      const asIncomingSender = await prisma.zaloMessage.count({
        where: { sender_id: args.user_id, direction: 'INCOMING', group_id: null },
      });
      const asRecipient = await prisma.zaloMessage.count({
        where: { recipient_id: args.user_id, direction: 'OUTGOING' },
      });
      if (asIncomingSender === 0 && asRecipient === 0) {
        return `❌ user_id=${args.user_id} không tìm thấy trong lịch sử chat (không phải INCOMING sender, không phải OUTGOING recipient). Có thể đây là user_id của SHOP. Vui lòng dùng list_zalo_threads(search:"tên") để lấy partner user_id đúng.`;
      }
      // Find the partner's display name: prefer from incoming msgs, else from outgoing echo
      const nameRow = await prisma.zaloMessage.findFirst({
        where: {
          OR: [
            { sender_id: args.user_id, direction: 'INCOMING' },
            { recipient_id: args.user_id, direction: 'OUTGOING' },
          ],
          sender_name: { not: null },
        },
        orderBy: { created_at: 'desc' },
        select: { sender_name: true },
      });
      const name = nameRow?.sender_name || args.user_id;
      const { ZaloService } = await import('../zalo/zalo.service');
      const result = await ZaloService.sendMessage(args.user_id, args.content);
      const msgId = result?.data?.msg_id || result?.msg_id || 'n/a';
      return `✅ Đã gửi đến "${name}" (user_id=${args.user_id}, msg_id=${msgId}). Nội dung: "${args.content}"`;
    }
    case 'send_zalo_group_message': {
      if (!args.group_id || !args.content) return '❌ Thiếu group_id hoặc content';
      const { ZaloService } = await import('../zalo/zalo.service');
      const result = await ZaloService.groupSendMessage(args.group_id, args.content);
      const msgId = result?.data?.msg_id || result?.msg_id || 'n/a';
      return `✅ Đã gửi vào group (group_id=${args.group_id}, msg_id=${msgId}). Nội dung: "${args.content}"`;
    }
    case 'export_customers_excel': {
      const { CustomerService } = await import('../customer/customer.service');
      const buffer = await CustomerService.exportExcel({
        search: args.search,
        customer_type: args.customer_type,
        city: args.city,
        has_debt: args.has_debt,
      });
      const { uploadExport } = await import('../../lib/cloudinary-export');
      const fileName = `danh-sach-khach-hang-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
      const url = await uploadExport(buffer, fileName);
      const count = Math.max(0, Math.floor((buffer.length - 2000) / 200)); // rough estimate for UX
      return `✅ Đã xuất Excel danh sách khách hàng (~${count > 0 ? count : '?'} dòng).\n📎 Link tải: ${url}\n[action:${url}|Tải file Excel]`;
    }
    case 'export_suppliers_excel': {
      const { SupplierService } = await import('../supplier/supplier.service');
      const buffer = await SupplierService.exportExcel({
        search: args.search,
        city: args.city,
        has_payable: args.has_payable,
      });
      const { uploadExport } = await import('../../lib/cloudinary-export');
      const fileName = `danh-sach-ncc-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
      const url = await uploadExport(buffer, fileName);
      return `✅ Đã xuất Excel danh sách nhà cung cấp.\n📎 Link tải: ${url}\n[action:${url}|Tải file Excel]`;
    }
    case 'export_products_excel': {
      const { ProductService } = await import('../product/product.service');
      const buffer = await ProductService.exportExcel({
        search: args.search,
        category_id: args.category_id,
        material: args.material,
        is_active: args.is_active,
      });
      const { uploadExport } = await import('../../lib/cloudinary-export');
      const fileName = `danh-sach-san-pham-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
      const url = await uploadExport(buffer, fileName);
      return `✅ Đã xuất Excel danh sách sản phẩm.\n📎 Link tải: ${url}\n[action:${url}|Tải file Excel]`;
    }
    case 'set_zalo_auto_reply': {
      if (!args.thread_key || typeof args.enabled !== 'boolean') return '❌ Thiếu thread_key hoặc enabled';
      const thread = await prisma.zaloThread.upsert({
        where: { thread_key: args.thread_key },
        update: { auto_reply_enabled: args.enabled },
        create: { thread_key: args.thread_key, auto_reply_enabled: args.enabled },
      });
      return `✅ Đã ${args.enabled ? 'BẬT' : 'TẮT'} auto-reply cho thread ${thread.thread_key}`;
    }
    // ─── AI Training handlers ───
    case 'list_ai_training': {
      const { AiTrainingService } = await import('./ai-training.service');
      const list = await AiTrainingService.list(args.category);
      if (list.length === 0) return 'Chưa có kiến thức nào được huấn luyện.';
      return list.map((e, i) => `${i + 1}. [${e.category}] ${e.title} [id:${e.id}]\n   ${e.content.slice(0, 200)}`).join('\n');
    }
    case 'add_ai_training': {
      if (!args.category || !args.title || !args.content) return '❌ Thiếu category/title/content';
      const { AiTrainingService } = await import('./ai-training.service');
      const e = await AiTrainingService.create({ category: args.category, title: args.title, content: args.content });
      cachedContext = null; // invalidate system context so new training takes effect immediately
      return `✅ Đã thêm kiến thức "${e.title}" vào [${e.category}] [id:${e.id}]`;
    }
    case 'delete_ai_training': {
      if (!args.id) return '❌ Thiếu id';
      const { AiTrainingService } = await import('./ai-training.service');
      await AiTrainingService.remove(args.id);
      cachedContext = null;
      return `✅ Đã xoá kiến thức [id:${args.id}]`;
    }
    // ─── Help ───
    case 'help': {
      return tools.map((t) => {
        const fn = (t as any).function;
        return `• ${fn.name} — ${fn.description}`;
      }).join('\n');
    }
    default: return 'Không hỗ trợ công cụ này.';
  }
}

/**
 * Sanitize customer-facing Zalo reply: remove forbidden emojis, markdown,
 * and detect/fix duplicated paragraphs (LLM sometimes emits same text twice).
 */
function sanitizeCustomerReply(raw: string): string {
  let s = (raw || '').trim();
  if (!s) return '';
  // Remove markdown markers
  s = stripMarkdown(s);
  // Remove forbidden emojis (keep 😊 only)
  s = s.replace(/🙏|👍|🥰|❤️|💯|🎉|✨|⭐|🔥/g, '');
  // Detect duplicated full response (LLM glitch): if text contains itself appended
  const half = Math.floor(s.length / 2);
  if (half > 30) {
    const left = s.slice(0, half).trim();
    const right = s.slice(half).trim();
    if (left && right && left.replace(/\s+/g, '') === right.replace(/\s+/g, '')) {
      s = left;
    }
  }
  // Remove "Dạ, em chưa rõ... <same paragraph>" type glitch: collapse exact duplicate consecutive paragraphs
  const paragraphs = s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const dedup: string[] = [];
  for (const p of paragraphs) {
    if (dedup.length === 0 || dedup[dedup.length - 1] !== p) dedup.push(p);
  }
  return dedup.join('\n\n').replace(/\s+$/g, '');
}

/**
 * Strip markdown bold/italic/heading markers from a complete string.
 * Used for non-streaming responses and final flush.
 */
function stripMarkdown(s: string): string {
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
function stripMarkdownStream(buf: string): { safe: string; remainder: string } {
  // Keep last 1 char pending in case it starts a "**" or "__" marker
  const lastChar = buf.slice(-1);
  const pending = lastChar === '*' || lastChar === '_' ? 1 : 0;
  const safe = stripMarkdown(buf.slice(0, buf.length - pending));
  const remainder = buf.slice(buf.length - pending);
  return { safe, remainder };
}

export class ChatbotService {
  /**
   * Get system overview context (cached 60s)
   */
  private static async getSystemContext(): Promise<string> {
    if (cachedContext && Date.now() - cacheTime < CACHE_TTL) return cachedContext;

    const now = dayjs();
    const [productCount, customerCount, supplierCount, soStats, poStats, recSummary, paySummary, cashIncome, cashExpense, overdueRec, overduePay] = await Promise.all([
      prisma.product.count({ where: { is_active: true } }),
      prisma.customer.count({ where: { is_active: true } }),
      prisma.supplier.count({ where: { is_active: true } }),
      prisma.salesOrder.groupBy({ by: ['status'], _count: true }),
      prisma.purchaseOrder.groupBy({ by: ['status'], _count: true }),
      prisma.receivable.aggregate({ where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, _sum: { remaining: true, original_amount: true, paid_amount: true }, _count: true }),
      prisma.payable.aggregate({ where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, _sum: { remaining: true, original_amount: true, paid_amount: true }, _count: true }),
      prisma.cashTransaction.aggregate({ where: { type: 'INCOME' }, _sum: { amount: true } }),
      prisma.cashTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } }),
      prisma.receivable.count({ where: { status: 'OVERDUE' } }),
      prisma.payable.count({ where: { status: 'OVERDUE' } }),
    ]);

    const { AiTrainingService } = await import('./ai-training.service');
    const trainingContext = await AiTrainingService.buildTrainingContext().catch(() => '');

    cachedContext = `
=== DỮ LIỆU PACKFLOW CRM (${now.format('DD/MM/YYYY HH:mm')}) ===
Sản phẩm: ${productCount} | Khách hàng: ${customerCount} | NCC: ${supplierCount}
Đơn bán: ${soStats.map(s => `${s.status}: ${s._count}`).join(', ')}
Đơn mua: ${poStats.map(s => `${s.status}: ${s._count}`).join(', ')}
Phải thu: ${recSummary._count} HĐ, gốc ${Number(recSummary._sum.original_amount || 0).toLocaleString()}, còn ${Number(recSummary._sum.remaining || 0).toLocaleString()} VND (${overdueRec} quá hạn)
Phải trả: ${paySummary._count} HĐ, gốc ${Number(paySummary._sum.original_amount || 0).toLocaleString()}, còn ${Number(paySummary._sum.remaining || 0).toLocaleString()} VND (${overduePay} quá hạn)
Sổ quỹ: Thu ${Number(cashIncome._sum.amount || 0).toLocaleString()}, Chi ${Number(cashExpense._sum.amount || 0).toLocaleString()}, Dư ${(Number(cashIncome._sum.amount || 0) - Number(cashExpense._sum.amount || 0)).toLocaleString()} VND${trainingContext ? `\n\n${trainingContext}` : ''}
`.trim();
    cacheTime = Date.now();
    return cachedContext;
  }

  /**
   * Chat with function calling + streaming. Optional image attachments are sent
   * to the vision model so Aura can "see" invoices, product photos, etc.
   */
  static async *chatStream(
    question: string,
    history: Array<{ role: string; content: string }> = [],
    attachments: Array<{ url: string; type: 'image' | 'file' }> = [],
  ): AsyncGenerator<string> {
    try {
      const systemContext = await this.getSystemContext();
      const imageUrls = attachments.filter((a) => a.type === 'image').map((a) => a.url);
      const hasImages = imageUrls.length > 0;
      const modelName = hasImages
        ? (config.openai.visionModel || config.openai.model || 'gpt-4o-mini')
        : (config.openai.model || 'gpt-4o-mini');

      const userContent: OpenAI.Chat.ChatCompletionUserMessageParam['content'] = hasImages
        ? [
            { type: 'text' as const, text: question },
            ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ]
        : question;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `Bạn tên là Aura — trợ lý AI của PackFlow CRM (quản lý kinh doanh bao bì nhựa).
Xưng "em", gọi user "anh". Lịch sự, chuyên nghiệp.

FORMAT — CỰC KỲ QUAN TRỌNG:
- TUYỆT ĐỐI KHÔNG dùng dấu ** để bold. VD SAI: "**Trần Trung Kiên**", "**Tổng số tin:** 50". VD ĐÚNG: "Trần Trung Kiên", "Tổng số tin: 50".
- KHÔNG dùng ##, ###, __, \`code\`, ---, > blockquote, bảng markdown.
- Liệt kê dùng "•" đầu dòng, KHÔNG dùng "-" hoặc "*".
- Số tiền: "123.456 VND" (dấu chấm ngăn cách).
- Nếu muốn nhấn mạnh, viết hoa "QUÁ HẠN" hoặc ngoặc đơn, KHÔNG dùng **.
- Trả lời GỌN. Thông tin đơn giản → 1-2 câu. Không cần "Dạ,..." mỗi câu.

HÀNH ĐỘNG — CỰC KỲ QUAN TRỌNG:
- Khi user ra LỆNH TRỰC TIẾP (VD "nhắn cho X là Y", "tạo đơn cho KH Z", "xoá SP A"), THỰC HIỆN NGAY qua tool. KHÔNG hỏi xác nhận nếu đã đủ thông tin.
- KHÔNG hỏi dư thừa kiểu "anh có muốn thêm gì không", "anh cần em làm gì nữa". Nếu user đã nói đủ, làm ngay.
- TUYỆT ĐỐI KHÔNG nói "em đã làm xong" / "đã gửi" / "đã tạo" NẾU CHƯA gọi tool và nhận được kết quả thành công. Nếu không gọi được tool (thiếu info, ambiguous) thì nói thẳng "em cần thêm thông tin X" — KHÔNG BỊA ra kết quả.
- Sau khi tool trả về thành công, báo lại NGẮN, có thể kèm tên đối tượng + ID để user verify, KHÔNG hỏi lại.

BẠN CÓ QUYỀN THỰC HIỆN HÀNH ĐỘNG (không chỉ đọc):
- Tạo/sửa/XÓA KH: create_customer, update_customer, delete_customer
- Tạo/sửa/XÓA NCC: create_supplier, update_supplier, delete_supplier
- Tạo/sửa/XÓA SP: create_product, update_product, delete_product
- Tạo/sửa đơn bán: create_sales_order · update_sales_order · thêm item add_sales_order_item · gỡ item remove_sales_order_item
- Tạo/sửa đơn mua: create_purchase_order (cần sales_order_id + supplier_id + items) · update_purchase_order
- Đổi trạng thái: update_sales_order_status, update_purchase_order_status
- Hóa đơn: create_sales_invoice, create_purchase_invoice, update_sales_invoice, finalize_invoice, cancel_invoice
- Trả hàng: create_sales_return, create_purchase_return
- Ghi nhận thanh toán: record_receivable_payment, record_payable_payment (evidence_url bắt buộc)
- Sổ quỹ: create_cash_transaction · create_cash_category
- Chi phí vận hành: create_operating_cost · create_operating_cost_category
- Danh mục SP: create_product_category
- Giá: upsert_customer_product_price, upsert_supplier_price
- Payroll: create_payroll_period, calculate_payroll, approve_payroll, mark_payroll_paid
- Alerts: mark_alert_read, take_alert_action
- Trợ giúp: help (liệt kê mọi tool)

QUY TRÌNH cho hành động có tham chiếu đối tượng:
1. Gọi search_customer/search_supplier/search_product trước để lấy id THẬT (UUID).
2. Với hành động phức tạp (tạo đơn): luôn xác nhận lại với user (tóm tắt input + hỏi "em thực hiện nhé?") TRƯỚC KHI gọi function write, TRỪ KHI user đã nói rõ "tạo ngay" / "xác nhận" / "làm đi".
3. Sau khi tạo xong, trả lời kèm action link đến bản ghi vừa tạo.

KHI USER GỬI ẢNH + HỎI "SẢN PHẨM NÀY CÓ KHÔNG" / "TÌM SP NÀY":
- LUÔN gọi find_product_by_image với image_urls (mảng) — có thể truyền 1 hoặc nhiều ảnh. KHÔNG tự đoán keyword rồi search_product
- Nếu user gửi nhiều ảnh cùng 1 SP (vd "đây là 3 góc của chai này"), truyền all vào image_urls để tổng hợp
- Nếu find_product_by_image trả về top match → liệt kê cho user chọn
- Nếu không có match → mới hỏi thêm thông tin (tên, kích thước, chất liệu)
- ACTION LINK: chỉ tạo action cho SẢN PHẨM ĐẦU TIÊN (top 1), label = TÊN SẢN PHẨM THẬT (vd "Chai PET 500ml"), KHÔNG dùng "match #1" / "mẫu 1" / placeholder
- Nếu user hỏi "mở sản phẩm thứ 2/3..." → dùng id tương ứng trong kết quả find_product_by_image đã trả trước đó

QUAN TRỌNG: id phải là UUID THẬT (36 ký tự, dạng xxxxxxxx-xxxx-...) lấy từ function response ([id:xxx]). CẤM bịa "123", "abc123". Nếu chưa có id → gọi search tool trước.

Khi trả lời xong, nếu có thể điều hướng, thêm dòng cuối:
[action:/đường-dẫn|Tên nút]
LABEL "Tên nút" phải là TÊN THẬT của đối tượng (vd "Chai PET 500ml", "Công ty ABC", "SO-20260422-001"), KHÔNG được dùng placeholder như "match #1", "mẫu 1", "SP số 1", "kết quả 1".
Đường dẫn:
- KH: /customers/{id}  |  Công nợ KH: /receivables/customer/{id}
- NCC: /suppliers/{id}  |  Công nợ NCC: /payables/supplier/{id}
- SP: /products/{id}
- Đơn bán: /sales-orders/{id}  |  Đơn mua: /purchase-orders/{id}

XỬ LÝ ẢNH ĐÍNH KÈM: Nếu user gửi ảnh, em nhìn trực tiếp vào ảnh và phân tích. Các tình huống thường gặp:
- Ảnh hóa đơn/phiếu mua hàng NCC → đọc ra NCC, từng dòng SP, số lượng, đơn giá, tổng tiền → xác nhận lại với user → gọi create_purchase_order.
- Ảnh sản phẩm bao bì → mô tả (loại, chất liệu, dung tích, màu) → nếu user muốn tạo SP mới thì hỏi thông tin bổ sung rồi gọi create_product.
- Ảnh danh sách khách hàng/NCC chép tay → đọc text → hỏi xác nhận → gọi create_customer/create_supplier lần lượt.
- Ảnh chuyển khoản/bill → đọc số tiền + tham chiếu → có thể dùng làm evidence_url cho record_*_payment (ảnh vừa upload đã có URL ở phía user).
Nếu không chắc nội dung ảnh, hỏi lại thay vì bịa.

Ngày hôm nay: ${dayjs().format('DD/MM/YYYY')}

${systemContext}`,
        },
        ...history.slice(-10).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: userContent },
      ];

      // Multi-round tool calling (up to 5 rounds)
      const MAX_ROUNDS = 5;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const response = await openai.chat.completions.create({
          model: modelName,
          messages, tools, tool_choice: 'auto',
          temperature: 0.3, max_tokens: 1500,
        });
        const choice = response.choices[0];

        if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
          // No more tools — stream final response
          const stream = await openai.chat.completions.create({
            model: modelName,
            messages, temperature: 0.3, max_tokens: 1500, stream: true,
          });
          let buf = '';
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (!delta) continue;
            buf += delta;
            const { safe, remainder } = stripMarkdownStream(buf);
            if (safe) yield safe;
            buf = remainder;
          }
          if (buf) yield stripMarkdown(buf);
          return;
        }

        messages.push(choice.message);
        for (const tc of choice.message.tool_calls) {
          const fn = (tc as any).function;
          let result: string;
          try {
            const args = JSON.parse(fn.arguments || '{}');
            result = await executeTool(fn.name, args);
          } catch (err: any) {
            result = `❌ Lỗi khi gọi ${fn.name}: ${err?.message || 'unknown'}`;
            logger.error(`Tool ${fn.name} failed:`, err);
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
      }
      // Max rounds reached — stream a final summary
      const stream = await openai.chat.completions.create({
        model: modelName,
        messages, temperature: 0.3, max_tokens: 1500, stream: true,
      });
      let buf2 = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (!delta) continue;
        buf2 += delta;
        const { safe, remainder } = stripMarkdownStream(buf2);
        if (safe) yield safe;
        buf2 = remainder;
      }
      if (buf2) yield stripMarkdown(buf2);
    } catch (err) {
      logger.error('Chatbot error:', err);
      yield 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.';
    }
  }

  /**
   * Non-streaming fallback
   */
  static async chat(
    question: string,
    history: Array<{ role: string; content: string }> = [],
    attachments: Array<{ url: string; type: 'image' | 'file' }> = [],
  ): Promise<string> {
    let result = '';
    for await (const chunk of this.chatStream(question, history, attachments)) {
      result += chunk;
    }
    return result;
  }

  /**
   * Extract packaging product attributes from a customer image URL.
   * Uses GPT-4o-mini vision with structured JSON output.
   */
  static async identifyProductFromImage(imageUrls: string | string[]): Promise<{
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
  }> {
    const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    const multi = urls.length > 1;
    try {
      // cx/gpt-5.4 vision + JSON mode is flaky — retry up to 3 times on empty response
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
      return {
        loai: null, chat_lieu: null, dung_tich_ml: null, mau: null,
        hinh_dang: null, co_chai_mm: null, ghi_chu: null,
        sku_tu_nhan: null, ten_tu_nhan: null, brand: null, text_khac: null,
        confidence: 0,
      };
    }
  }

  /**
   * Customer-facing reply for Zalo auto-reply.
   * No function calling (read-only, safe for external customers).
   * Uses a shop-assistant persona (not CRM internal assistant).
   */
  static async customerReply(
    question: string,
    history: Array<{ role: string; content: string }> = [],
    customSystemPrompt?: string,
    imageUrls: string[] = [],
  ): Promise<string> {
    try {
      const defaultPrompt = `Em là nhân viên sale của PackFlow — chuyên bao bì nhựa cho shop mỹ phẩm, thực phẩm, hóa chất (chai PET, hũ, nắp, can, lọ, túi PE, thùng).

NHÂN VẬT:
Em có 2-3 năm kinh nghiệm tư vấn bao bì, am hiểu sản phẩm, biết mẫu nào hợp với ngành nào. Em đang chat Zalo với khách — giống như em đang nhắn tin với bạn bè trên điện thoại, không phải đang viết email.

CÁCH NHẮN TIN:
- Ngắn. 1-2 câu phần lớn. Tin nhắn dài hơn 3 dòng là DÀI QUÁ, cắt bớt.
- Gọi khách "anh" mặc định. Chỉ đổi "chị" khi biết chắc khách là nữ (khách tự xưng, hoặc tên rõ nữ). TUYỆT ĐỐI KHÔNG viết "anh/chị" kiểu điền form — nhân viên thật không nói như vậy.
- Đừng mở đầu "Dạ" mỗi tin. Biến hóa: "Dạ", "Vâng", "Anh ơi", "À", "Được anh", "Ok anh", vào thẳng nội dung, hoặc không có gì cả. Người thật không lặp 1 từ mở đầu.
- Dùng filler tự nhiên: "nha", "nhé", "ạ", "nè", "đó", "á" — nhưng không lạm dụng (1 từ filler/câu là đủ).
- Emoji 😊 dùng thỉnh thoảng, không phải mỗi tin. Tuyệt đối không 🙏 hay emoji khác.
- Tránh văn phòng: "xin quý khách vui lòng", "trân trọng", "kính chào", "ạ." ở cuối mỗi câu một cách máy móc.

TƯ VẤN NHƯ NHÂN VIÊN BÁN HÀNG THẬT:
- Khách hỏi chung chung ("cần bao bì", "shop có SP gì") → ĐỪNG đọc danh sách. HỎI MỤC ĐÍCH: "Anh đang định đóng gói gì để em gợi ý đúng mẫu ạ?" Sau khi biết mục đích mới tư vấn cụ thể.
- Khách nói mục đích cụ thể (đựng nước, mỹ phẩm, tương ớt...) → tự chọn 1-2 mẫu hợp + gọi lookup_product để lấy giá → gợi ý có lý do: "Đựng nước giải khát 500ml thì anh nên lấy PET 500ml trơn, giá tham khảo 3.000đ/chai, MOQ 500. Đây là mẫu bán chạy nhất cho bên nước uống anh ạ."
- Khách hỏi SP cụ thể ("chai PET 500ml") → lookup_product → báo ngay giá + MOQ + ưu điểm nổi bật (không chỉ đọc số).
- Nếu lookup ra nhiều mẫu → chọn 1-2 mẫu ĐỀ XUẤT dựa vào ngữ cảnh, đừng dump cả list. VD: "Bên em có 2 mẫu phổ biến: PET-500 trơn 3.500đ (đóng nước bình thường), PLB-PET-2026-0003 hơi dày hơn 3.000đ (đóng hóa chất nhẹ). Anh đựng cái gì để em chốt đúng mẫu?"
- Khách kêu đắt → ĐỪNG chỉ hỏi "tầm giá bao nhiêu". Gợi ý trước: "Nếu anh lấy trên 3.000 chai giá em sẽ giảm thêm được. Hoặc em có mẫu tương đương rẻ hơn 10-15% nhưng chất vẫn ổn, anh muốn xem không?"
- Chốt: Khi khách có ý định mua → chủ động "Anh cho em xin SĐT, bên em báo giá chính thức + gửi mẫu test nếu anh cần." — ĐỪNG chỉ "em chuyển nhân viên liên hệ".

NGHIỆP VỤ (bắt buộc):
- BẤT KỲ câu hỏi nào liên quan SP (có bán X, giá X, còn hàng X, SP nào phù hợp...) → GỌI lookup_product TRƯỚC khi trả lời. KHÔNG BIỆN LÝ DO "em chưa rõ", "để em check" mà không gọi tool.
- lookup_product nhận query tự nhiên: "túi PE", "chai PET 500ml", "nắp flip top", "can HDPE 5L", v.v.
- Giá từ lookup_product luôn kèm note "giá tham khảo, tùy số lượng" (nói tự nhiên, không lặp nguyên xi).
- Khách hỏi giao hàng cụ thể / chốt đơn → xin SĐT + chuyển nhân viên (không tự chốt).

CẤM (nghiêm ngặt):
- Không nói mình là AI/bot. Nếu bị hỏi → "em là tư vấn của shop anh" + quay về chủ đề.
- Không nhắc CRM, hệ thống nội bộ.
- Không markdown. Plain text.
- Không bịa: giá, tồn kho, địa chỉ shop, SĐT, email. Nếu thiếu data → hỏi khách SĐT để nhân viên liên hệ.
- Không hỏi ngu: "Anh cần gì ạ?" ngay sau khi khách đã mô tả rõ; "Anh/chị có muốn mua không?" sau khi khách đã báo số lượng; hỏi lại info khách vừa cung cấp.

KHI KHÁCH GỬI ẢNH:
- Mô tả nhanh thấy gì: loại + chất liệu đoán + kích thước đoán + màu.
- Gọi lookup_product với từ khóa match.
- Nếu không match → hỏi lại kích thước/dung tích để tìm đúng.
- Nếu ảnh mờ/không phải bao bì → nói thẳng "Ảnh hơi mờ em chưa rõ, anh mô tả thêm giúp em nhé."

VÍ DỤ MẪU (học style này):

Khách: "chào bạn"
Em: "Em chào anh ạ. Anh đang cần bao bì để đóng gói mặt hàng gì để em gợi ý mẫu phù hợp nhé?"

Khách: "tôi muốn tư vấn"
Em: "Anh cần bao bì cho sản phẩm gì ạ? Nước uống, mỹ phẩm, hay thực phẩm khô? Em gợi ý luôn cho anh."

Khách: "bên mình có SP gì"
Em: "Shop em có đủ dòng chai PET, hũ, nắp, can HDPE, túi PE đó anh. Anh dùng cho ngành nào để em tư vấn đúng mẫu?"

Khách: "tôi đóng nước suối 500ml"
→ lookup_product("chai PET 500ml")
Em: "Vậy anh dùng PET 500ml là chuẩn rồi, bên em có mẫu PET-500 trơn 3.500đ/chai, MOQ 200 chai, form bán chạy nhất cho nước. Anh dự tính lấy tầm bao nhiêu để em báo giá sát nhất?"

Khách: "có túi PE không"
→ lookup_product("túi PE")
Em: "Có anh ạ, bên em có 2 size phổ biến: 30x40cm (150đ/túi) và 40x60cm (250đ/túi), MOQ 500 túi. Anh đóng gói mặt hàng gì để em tư vấn size phù hợp?"

Khách: "đắt thế"
Em: "Em hiểu mà anh. Lấy số lượng lớn em sẽ chiết khấu thêm, hoặc em có mẫu tương đương rẻ hơn khoảng 10-15% nhưng vẫn đảm bảo, anh muốn xem không?"

Khách: "lấy 3000 chai thì sao"
Em: "3000 chai thì em báo giá riêng cho anh, mềm hơn giá lẻ kha khá đó. Anh gửi em SĐT + email, bên em gửi báo giá chính thức + gửi mẫu test luôn nha."

Khách: "shop ở đâu" (không có data)
Em: "Để em kết nối nhân viên gửi thông tin chi tiết cho anh ạ. Anh cho em xin số điện thoại nhé."

Khách: [ảnh túi PE 40x60] "có không em"
→ lookup_product("túi PE 40x60")
Em: "Nhìn giống túi PE trong suốt khoảng 40x60cm đúng không anh? Mẫu này bên em có, 250đ/túi, MOQ 500. Anh đóng gói gì để em check độ dày phù hợp nha?"

Khách: "em là bot à"
Em: "Em là nhân viên tư vấn của shop anh ạ. Anh cần tư vấn mẫu nào không ạ?"`;

      const systemPrompt = (customSystemPrompt && customSystemPrompt.trim().length > 0)
        ? customSystemPrompt
        : defaultPrompt;

      const customerTools: OpenAI.Chat.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'lookup_product',
            description: 'Tra cứu sản phẩm. BẮT BUỘC gọi khi khách hỏi bất kỳ gì về SP: tên cụ thể, SKU, hoặc TỪ KHOÁ LOẠI ("túi PE", "chai PET", "nắp", "can"). Fuzzy match trên tên/SKU/mô tả. Trả về danh sách mẫu + giá + MOQ.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Tên SP, SKU, loại, hoặc mô tả. VD: "chai PET 500ml", "PET-500", "túi PE", "nắp 24", "can HDPE 5L"' },
              },
              required: ['query'],
            },
          },
        },
      ];

      const hasImages = imageUrls.length > 0;
      const modelName = hasImages
        ? (config.openai.visionModel || config.openai.model || 'gpt-4o-mini')
        : (config.openai.model || 'gpt-4o-mini');

      const userContent: OpenAI.Chat.ChatCompletionUserMessageParam['content'] = hasImages
        ? [
            { type: 'text' as const, text: question || 'Em xem ảnh này giúp anh/chị' },
            ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ]
        : question;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map((h) => ({
          role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: userContent },
      ];

      // Up to 2 rounds of tool calling. Higher temperature + top_p for natural variance.
      for (let round = 0; round < 2; round++) {
        const response = await openai.chat.completions.create({
          model: modelName,
          messages, tools: customerTools, tool_choice: 'auto',
          temperature: 0.85, top_p: 0.9, presence_penalty: 0.3, frequency_penalty: 0.3,
          max_tokens: 300,
        });
        const choice = response.choices[0];

        if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
          return sanitizeCustomerReply(choice.message.content || '');
        }

        messages.push(choice.message);
        for (const tc of choice.message.tool_calls) {
          const fn = (tc as any).function;
          let result: string;
          try {
            const args = JSON.parse(fn.arguments || '{}');
            if (fn.name === 'lookup_product') {
              result = await this.customerLookupProduct(args.query || '');
            } else {
              result = `Tool "${fn.name}" không hỗ trợ`;
            }
          } catch (err: any) {
            result = `Lỗi: ${err?.message || 'unknown'}`;
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
      }

      // Fallback: final response without more tools
      const final = await openai.chat.completions.create({
        model: modelName,
        messages, temperature: 0.85, top_p: 0.9, presence_penalty: 0.3, frequency_penalty: 0.3,
        max_tokens: 300,
      });
      return sanitizeCustomerReply(final.choices[0]?.message?.content || '');
    } catch (err) {
      logger.error('customerReply error:', err);
      return '';
    }
  }

  /** Safe product lookup for customer queries — read-only, no pricing secrets. */
  private static async customerLookupProduct(query: string): Promise<string> {
    try {
      const q = (query || '').trim();
      if (!q) return 'Không có từ khoá để tìm.';
      const products = await prisma.product.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          sku: true, name: true, retail_price: true,
          material: true, capacity_ml: true, moq: true,
          height_mm: true, body_dia_mm: true,
        },
      });
      if (products.length === 0) return `Không tìm thấy sản phẩm khớp với "${q}".`;
      const lines = products.map((p) => {
        const parts: string[] = [`${p.name} (SKU ${p.sku})`];
        if (p.material) parts.push(p.material);
        if (p.capacity_ml) parts.push(`${p.capacity_ml}ml`);
        if (p.retail_price) parts.push(`giá tham khảo ${Math.round(p.retail_price).toLocaleString('vi-VN')}đ`);
        if (p.moq) parts.push(`MOQ ${p.moq}`);
        return parts.join(' — ');
      });
      return lines.join('\n');
    } catch (err) {
      logger.error('customerLookupProduct error:', err);
      return 'Lỗi khi tra cứu sản phẩm.';
    }
  }
}
