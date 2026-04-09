import prisma from '../../lib/prisma';
import { t } from '../../locales';
import logger from '../../utils/logger';
import { AIService, ExtractedOrder } from '../ai/ai.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { VATRate } from '@prisma/client';

export class ZaloOrderService {
  /**
   * Process an incoming Zalo message and auto-create a sales order if applicable.
   */
  static async processMessage(
    senderId: string,
    senderName: string,
    content: string,
  ): Promise<{ created: boolean; order_code?: string; reason?: string }> {
    try {
      // 1. Get product list for AI context
      const products = await prisma.product.findMany({
        where: { is_active: true },
        select: { id: true, name: true, sku: true, retail_price: true, wholesale_price: true },
        take: 200,
      });

      const productList = products.map(
        (p) => `- ${p.name} (SKU: ${p.sku}, giá lẻ: ${p.retail_price ?? 'N/A'}, giá sỉ: ${p.wholesale_price ?? 'N/A'})`,
      );

      // 2. Call AI to extract order info
      const extracted = await AIService.extractOrderFromMessage(content, productList);

      if (!extracted.is_order || extracted.items.length === 0) {
        logger.info(`Zalo auto-order: not an order message from ${senderName}`);
        return { created: false, reason: extracted.raw_summary || t('zalo.notAnOrderMessage') };
      }

      // 3. Match or create customer
      const customerId = await this.resolveCustomer(senderId, senderName, extracted);

      // 4. Match products and build order items
      const orderItems = await this.matchProducts(extracted, products);

      if (orderItems.length === 0) {
        logger.warn(`Zalo auto-order: no products matched for message from ${senderName}`);
        return { created: false, reason: t('zalo.noMatchingProducts') };
      }

      // 5. Create sales order
      const order = await SalesOrderService.create({
        customer_id: customerId,
        vat_rate: 'VAT_10' as VATRate,
        notes: `[Zalo Auto] Từ: ${senderName} | ${extracted.delivery_note || ''} | AI: ${extracted.raw_summary || ''}`.trim(),
        items: orderItems,
      });

      logger.info(`Zalo auto-order: created ${order.order_code} for ${senderName} with ${orderItems.length} items`);
      return { created: true, order_code: order.order_code };
    } catch (err: any) {
      logger.error('Zalo auto-order error:', err.message);
      return { created: false, reason: err.message };
    }
  }

  /**
   * Find existing customer by zalo_user_id, phone, or name. Create if not found.
   */
  private static async resolveCustomer(
    senderId: string,
    senderName: string,
    extracted: ExtractedOrder,
  ): Promise<string> {
    // Try by zalo_user_id
    if (senderId) {
      const byZalo = await prisma.customer.findFirst({
        where: { zalo_user_id: senderId, is_active: true },
      });
      if (byZalo) return byZalo.id;
    }

    // Try by phone from AI extraction
    if (extracted.customer_phone) {
      const byPhone = await prisma.customer.findFirst({
        where: { phone: { contains: extracted.customer_phone }, is_active: true },
      });
      if (byPhone) {
        // Link zalo_user_id for future lookups
        if (senderId && !byPhone.zalo_user_id) {
          await prisma.customer.update({ where: { id: byPhone.id }, data: { zalo_user_id: senderId } });
        }
        return byPhone.id;
      }
    }

    // Try by name
    const customerName = extracted.customer_name || senderName;
    if (customerName) {
      const byName = await prisma.customer.findFirst({
        where: { company_name: { contains: customerName, mode: 'insensitive' }, is_active: true },
      });
      if (byName) {
        if (senderId && !byName.zalo_user_id) {
          await prisma.customer.update({ where: { id: byName.id }, data: { zalo_user_id: senderId } });
        }
        return byName.id;
      }
    }

    // Create new customer
    const newCustomer = await prisma.customer.create({
      data: {
        company_name: customerName || `Zalo: ${senderId}`,
        contact_name: customerName || senderName,
        phone: extracted.customer_phone || '',
        zalo_user_id: senderId || null,
        customer_type: 'RETAIL',
      },
    });

    logger.info(`Zalo auto-order: created new customer "${newCustomer.company_name}"`);
    return newCustomer.id;
  }

  /**
   * Match extracted items to actual products in the database using fuzzy name search.
   */
  private static async matchProducts(
    extracted: ExtractedOrder,
    products: Array<{ id: string; name: string; sku: string; retail_price: any; wholesale_price: any }>,
  ) {
    const items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      packaging_note?: string;
    }> = [];

    for (const extractedItem of extracted.items) {
      const searchName = extractedItem.product_name.toLowerCase();

      // Try exact SKU match first
      let matched = products.find(
        (p) => p.sku.toLowerCase() === searchName,
      );

      // Try name contains match
      if (!matched) {
        matched = products.find(
          (p) => p.name.toLowerCase().includes(searchName) || searchName.includes(p.name.toLowerCase()),
        );
      }

      // Try partial word match
      if (!matched) {
        const words = searchName.split(/\s+/).filter((w) => w.length > 2);
        matched = products.find((p) => {
          const pName = p.name.toLowerCase();
          return words.filter((w) => pName.includes(w)).length >= Math.ceil(words.length / 2);
        });
      }

      if (matched) {
        const price = extractedItem.unit_price
          || Number(matched.wholesale_price ?? 0)
          || Number(matched.retail_price ?? 0)
          || 0;

        items.push({
          product_id: matched.id,
          quantity: extractedItem.quantity,
          unit_price: price,
          packaging_note: extractedItem.note || undefined,
        });
      } else {
        logger.warn(`Zalo auto-order: could not match product "${extractedItem.product_name}"`);
      }
    }

    return items;
  }
}
