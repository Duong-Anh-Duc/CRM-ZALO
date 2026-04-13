import prisma from '../../lib/prisma';
import { t } from '../../locales';
import logger from '../../utils/logger';
import { AIService } from '../ai/ai.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { ZaloService } from './zalo.service';
import { VATRate } from '@prisma/client';
import dayjs from 'dayjs';

export class ZaloOrderService {
  /**
   * Process an incoming Zalo message — create a suggestion (not an order) if it looks like an order.
   */
  static async processMessage(
    senderId: string,
    senderName: string,
    content: string,
  ): Promise<{ suggested: boolean; reason?: string }> {
    try {
      const products = await prisma.product.findMany({
        where: { is_active: true },
        select: { id: true, name: true, sku: true, retail_price: true, wholesale_price: true },
        take: 200,
      });

      const productList = products.map(
        (p) => `- ${p.name} (SKU: ${p.sku}, giá lẻ: ${p.retail_price ?? 'N/A'}, giá sỉ: ${p.wholesale_price ?? 'N/A'})`,
      );

      const extracted = await AIService.extractOrderFromMessage(content, productList);

      if (!extracted.is_order || extracted.items.length === 0) {
        return { suggested: false, reason: extracted.raw_summary || t('zalo.notAnOrderMessage') };
      }

      // Match products
      const matchedItems = this.matchProducts(extracted, products);

      // Create suggestion for approval
      await prisma.orderSuggestion.create({
        data: {
          sender_id: senderId,
          sender_name: senderName,
          message: content,
          ai_summary: extracted.raw_summary || '',
          customer_name: extracted.customer_name || senderName,
          customer_phone: extracted.customer_phone || null,
          delivery_note: extracted.delivery_note || null,
          extracted_items: extracted.items as any,
          matched_items: matchedItems as any,
          status: 'PENDING',
        },
      });

      logger.info(`Zalo order suggestion: created for ${senderName} with ${matchedItems.length} matched items`);
      return { suggested: true };
    } catch (err: any) {
      logger.error('Zalo order suggestion error:', err.message);
      return { suggested: false, reason: err.message };
    }
  }

  /**
   * Approve a suggestion → create Customer + Sales Order + Purchase Order(s).
   */
  static async approve(suggestionId: string) {
    const suggestion = await prisma.orderSuggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion) throw new Error(t('common.notFound'));
    if (suggestion.status !== 'PENDING') throw new Error(t("zalo.suggestionProcessed"));

    const matched = (suggestion.matched_items || []) as any[];
    if (matched.length === 0) throw new Error(t("zalo.noItemsMatched"));

    // 1. Resolve/create customer
    const customerId = await this.resolveCustomer(
      suggestion.sender_id,
      suggestion.sender_name,
      suggestion.customer_name,
      suggestion.customer_phone,
    );

    const deliveryDate = suggestion.delivery_note
      ? dayjs().add(7, 'day').format('YYYY-MM-DD')
      : undefined;

    // 2. Create Sales Order (bán cho khách)
    const salesOrder = await SalesOrderService.create({
      customer_id: customerId,
      vat_rate: 'VAT_10' as VATRate,
      expected_delivery: deliveryDate,
      notes: `[Zalo] Từ: ${suggestion.sender_name} | ${suggestion.delivery_note || ''} | AI: ${suggestion.ai_summary || ''}`.trim(),
      items: matched.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        packaging_note: item.note || undefined,
      })),
    });

    // 3. Create Purchase Order(s) (mua từ NCC)
    const purchaseOrders = await this.createPurchaseOrders(matched, suggestion.sender_name, salesOrder.order_code);

    await prisma.orderSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'APPROVED', sales_order_id: salesOrder.id },
    });

    logger.info(`Zalo order approved: SO=${salesOrder.order_code}, POs=${purchaseOrders.map(p => p.order_code).join(',')} from suggestion ${suggestionId}`);
    return { salesOrder, purchaseOrders };
  }

  /**
   * Auto-create Purchase Orders grouped by preferred supplier.
   */
  private static async createPurchaseOrders(matchedItems: any[], customerName: string, salesOrderCode: string) {
    // Find preferred suppliers for each product
    const supplierPrices = await prisma.supplierPrice.findMany({
      where: {
        product_id: { in: matchedItems.map((i: any) => i.product_id) },
        is_preferred: true,
      },
      include: { supplier: { select: { id: true, company_name: true } } },
    });

    // Group items by supplier
    const supplierMap = new Map<string, { supplierId: string; supplierName: string; items: any[] }>();

    for (const item of matchedItems) {
      const sp = supplierPrices.find((s) => s.product_id === item.product_id);
      if (!sp) {
        logger.warn(`No preferred supplier for product ${item.product_name}, skipping PO`);
        continue;
      }

      const key = sp.supplier_id;
      if (!supplierMap.has(key)) {
        supplierMap.set(key, { supplierId: sp.supplier_id, supplierName: sp.supplier.company_name, items: [] });
      }
      supplierMap.get(key)!.items.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: sp.purchase_price, // giá mua từ NCC
      });
    }

    // Create PO for each supplier
    const purchaseOrders = [];
    for (const [, group] of supplierMap) {
      const po = await PurchaseOrderService.create({
        supplier_id: group.supplierId,
        expected_delivery: dayjs().add(7, 'day').format('YYYY-MM-DD'),
        notes: `[Auto] Từ đơn bán ${salesOrderCode} | Khách: ${customerName}`,
        items: group.items,
      });
      purchaseOrders.push(po);
      logger.info(`Auto PO created: ${po.order_code} from ${group.supplierName}`);
    }

    return purchaseOrders;
  }

  /**
   * Reject a suggestion.
   */
  static async reject(suggestionId: string, reason?: string) {
    const suggestion = await prisma.orderSuggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion) throw new Error(t('common.notFound'));
    if (suggestion.status !== 'PENDING') throw new Error(t("zalo.suggestionProcessed"));

    await prisma.orderSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'REJECTED', rejected_reason: reason || null },
    });

    return { rejected: true };
  }

  /**
   * List suggestions with optional status filter.
   */
  static async list(status?: string) {
    return prisma.orderSuggestion.findMany({
      where: status ? { status } : undefined,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get pending count.
   */
  static async getPendingCount() {
    return prisma.orderSuggestion.count({ where: { status: 'PENDING' } });
  }

  // ──── Private helpers ────

  private static matchProducts(
    extracted: any,
    products: Array<{ id: string; name: string; sku: string; retail_price: any; wholesale_price: any }>,
  ) {
    const items: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; note?: string }> = [];

    for (const extractedItem of extracted.items) {
      const searchName = extractedItem.product_name.toLowerCase();

      let matched = products.find((p) => p.sku.toLowerCase() === searchName);

      if (!matched) {
        matched = products.find(
          (p) => p.name.toLowerCase().includes(searchName) || searchName.includes(p.name.toLowerCase()),
        );
      }

      if (!matched) {
        const words = searchName.split(/\s+/).filter((w: string) => w.length > 2);
        matched = products.find((p) => {
          const pName = p.name.toLowerCase();
          return words.filter((w: string) => pName.includes(w)).length >= Math.ceil(words.length / 2);
        });
      }

      if (matched) {
        const price = extractedItem.unit_price
          || Number(matched.wholesale_price ?? 0)
          || Number(matched.retail_price ?? 0)
          || 0;

        items.push({
          product_id: matched.id,
          product_name: matched.name,
          quantity: extractedItem.quantity,
          unit_price: price,
          note: extractedItem.note || undefined,
        });
      } else {
        logger.warn(`Zalo suggestion: could not match product "${extractedItem.product_name}"`);
      }
    }

    return items;
  }

  private static async resolveCustomer(
    senderId: string,
    senderName: string,
    customerName?: string | null,
    customerPhone?: string | null,
  ): Promise<string> {
    if (senderId) {
      const byZalo = await prisma.customer.findFirst({ where: { zalo_user_id: senderId, is_active: true } });
      if (byZalo) return byZalo.id;
    }

    if (customerPhone) {
      const byPhone = await prisma.customer.findFirst({ where: { phone: { contains: customerPhone }, is_active: true } });
      if (byPhone) {
        if (senderId && !byPhone.zalo_user_id) {
          await prisma.customer.update({ where: { id: byPhone.id }, data: { zalo_user_id: senderId } });
        }
        return byPhone.id;
      }
    }

    const name = customerName || senderName;
    if (name) {
      const byName = await prisma.customer.findFirst({ where: { company_name: { contains: name, mode: 'insensitive' }, is_active: true } });
      if (byName) {
        if (senderId && !byName.zalo_user_id) {
          await prisma.customer.update({ where: { id: byName.id }, data: { zalo_user_id: senderId } });
        }
        return byName.id;
      }
    }

    // Enrich from Zalo getUserInfo + thread data
    let phone = customerPhone || '';
    let enrichedName = name || senderName;
    try {
      const originId = senderId?.replace('zu', '') || '';
      if (originId) {
        const userInfo = await ZaloService.getUserInfo(originId) as any;
        if (userInfo) {
          if (userInfo.phoneNumber && !phone) phone = userInfo.phoneNumber;
          if (userInfo.displayName && !enrichedName) enrichedName = userInfo.displayName;
        }
      }
    } catch { /* getUserInfo may not be configured */ }

    // Also check thread data for phone (from GET_THREADS cache in Func.vn)
    if (!phone) {
      try {
        const threads = await ZaloService.getThreads();
        const thread = threads.find((t: any) => t.pid === senderId);
        if (thread?.phone) phone = thread.phone;
      } catch { /* skip */ }
    }

    const nameForType = (enrichedName || senderName || '').toLowerCase();
    const autoType = /công ty|tnhh|cp |cổ phần/.test(nameForType) ? 'BUSINESS'
      : /cơ sở|cửa hàng|shop|quán/.test(nameForType) ? 'RETAIL'
      : /đại lý/.test(nameForType) ? 'BUSINESS' : 'INDIVIDUAL';

    const newCustomer = await prisma.customer.create({
      data: {
        company_name: enrichedName || `Zalo: ${senderId}`,
        contact_name: enrichedName || senderName,
        phone: phone || '',
        zalo_user_id: senderId || null,
        customer_type: autoType as any,
      },
    });

    return newCustomer.id;
  }
}
