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
        return `${i + 1}. ${c.company_name || c.contact_name} [id:${c.id}] | SĐT: ${c.phone || '-'} | ${c._count.sales_orders} đơn | Nợ: ${debt.toLocaleString()} VND`;
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
      return suppliers.map((s, i) => `${i + 1}. ${s.company_name} [id:${s.id}] | SĐT: ${s.phone || '-'}`).join('\n');
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

    cachedContext = `
=== DỮ LIỆU PACKFLOW CRM (${now.format('DD/MM/YYYY HH:mm')}) ===
Sản phẩm: ${productCount} | Khách hàng: ${customerCount} | NCC: ${supplierCount}
Đơn bán: ${soStats.map(s => `${s.status}: ${s._count}`).join(', ')}
Đơn mua: ${poStats.map(s => `${s.status}: ${s._count}`).join(', ')}
Phải thu: ${recSummary._count} HĐ, gốc ${Number(recSummary._sum.original_amount || 0).toLocaleString()}, còn ${Number(recSummary._sum.remaining || 0).toLocaleString()} VND (${overdueRec} quá hạn)
Phải trả: ${paySummary._count} HĐ, gốc ${Number(paySummary._sum.original_amount || 0).toLocaleString()}, còn ${Number(paySummary._sum.remaining || 0).toLocaleString()} VND (${overduePay} quá hạn)
Sổ quỹ: Thu ${Number(cashIncome._sum.amount || 0).toLocaleString()}, Chi ${Number(cashExpense._sum.amount || 0).toLocaleString()}, Dư ${(Number(cashIncome._sum.amount || 0) - Number(cashExpense._sum.amount || 0)).toLocaleString()} VND
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

Format: KHÔNG markdown (**, ##, -). Dùng "•" liệt kê. Số tiền: xxx.xxx VND.
Mở đầu bằng "Dạ,...", kết thúc hỏi thêm.

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
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) yield delta;
          }
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
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
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
  ): Promise<string> {
    try {
      const defaultPrompt = `Bạn là trợ lý chăm sóc khách hàng của công ty bao bì nhựa PackFlow.
Xưng "em", gọi khách là "anh/chị". Lịch sự, thân thiện, trả lời ngắn gọn (1-3 câu).

NHIỆM VỤ:
- Chào hỏi, cảm ơn khách nhắn tin
- Tư vấn chung về sản phẩm bao bì nhựa (chai PET, hũ, nắp, thùng, can...)
- Khi khách hỏi về sản phẩm cụ thể (giá, thông số, MOQ) → GỌI lookup_product để tra cứu rồi trả lời
- Khi khách hỏi còn hàng / tồn kho / giao hàng cụ thể → mời để lại SĐT cho nhân viên

QUY TẮC:
- KHÔNG nói mình là AI / chatbot / trợ lý CRM
- KHÔNG đề cập đến hệ thống nội bộ (đơn bán, công nợ, phân quyền)
- KHÔNG bịa giá cụ thể — LUÔN dùng lookup_product trước khi nói giá
- Trả lời KHÔNG dùng markdown. Đơn giản, tự nhiên như người thật.
- Giá trả về từ lookup_product là giá tham khảo — khi nói giá cụ thể thêm "giá tham khảo, tuỳ số lượng có thể thay đổi"`;

      const systemPrompt = (customSystemPrompt && customSystemPrompt.trim().length > 0)
        ? customSystemPrompt
        : defaultPrompt;

      const customerTools: OpenAI.Chat.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'lookup_product',
            description: 'Tra cứu sản phẩm theo tên, SKU, hoặc số thứ tự mẫu đã gợi ý trước đó. Trả về giá tham khảo + thông số (dung tích, chất liệu, MOQ).',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Tên SP, SKU, hoặc mô tả (vd "chai PET 500ml", "PET-500-TR", "mẫu 1")' },
              },
              required: ['query'],
            },
          },
        },
      ];

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map((h) => ({
          role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: question },
      ];

      // Up to 2 rounds of tool calling
      for (let round = 0; round < 2; round++) {
        const response = await openai.chat.completions.create({
          model: config.openai.model || 'gpt-4o-mini',
          messages, tools: customerTools, tool_choice: 'auto',
          temperature: 0.6, max_tokens: 400,
        });
        const choice = response.choices[0];

        if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
          return (choice.message.content || '').trim();
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
        model: config.openai.model || 'gpt-4o-mini',
        messages, temperature: 0.6, max_tokens: 400,
      });
      return (final.choices[0]?.message?.content || '').trim();
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
