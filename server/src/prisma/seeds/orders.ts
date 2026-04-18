import { PrismaClient, Customer, Supplier } from '@prisma/client';
import dayjs from 'dayjs';

export async function seedOrders(
  prisma: PrismaClient,
  customers: Customer[],
  suppliers: Supplier[]
) {
  const products = await prisma.product.findMany({ take: 10 });
  if (products.length === 0) return;

  // Sales Orders
  const salesStatuses = ['NEW', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED'] as const;

  for (let i = 0; i < 20; i++) {
    const customer = customers[i % customers.length];
    const status = salesStatuses[i % salesStatuses.length];
    const orderDate = dayjs().subtract(Math.floor(Math.random() * 90), 'day');
    const orderCode = `SO-${orderDate.format('YYYYMMDD')}-${String(i + 1).padStart(3, '0')}`;

    const itemCount = 1 + Math.floor(Math.random() * 3);
    const items = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = products[(i + j) % products.length];
      const qty = (1 + Math.floor(Math.random() * 10)) * 100;
      const price = product.retail_price || 1000;
      const lineTotal = qty * price;
      subtotal += lineTotal;
      items.push({
        product_id: product.id,
        quantity: qty,
        unit_price: price,
        discount_pct: 0,
        line_total: lineTotal,
      });
    }

    const vatAmount = subtotal * 0.1;
    const grandTotal = subtotal + vatAmount;

    const order = await prisma.salesOrder.upsert({
      where: { order_code: orderCode },
      update: {},
      create: {
        order_code: orderCode,
        customer_id: customer.id,
        order_date: orderDate.toDate(),
        expected_delivery: orderDate.add(14, 'day').toDate(),
        subtotal,
        vat_rate: 'VAT_10',
        vat_amount: vatAmount,
        grand_total: grandTotal,
        status,
        items: { create: items },
      },
    });

    // Create receivable for confirmed+ orders
    if (['CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED'].includes(status)) {
      const dueDate = orderDate.add(30, 'day');
      const isPaid = status === 'COMPLETED' && Math.random() > 0.5;
      const isPartial = !isPaid && Math.random() > 0.5;
      const paidAmount = isPaid ? grandTotal : isPartial ? grandTotal * 0.5 : 0;

      await prisma.receivable.create({
        data: {
          sales_order_id: order.id,
          customer_id: customer.id,
          invoice_number: `INV-${orderCode}`,
          invoice_date: orderDate.toDate(),
          due_date: dueDate.toDate(),
          original_amount: grandTotal,
          paid_amount: paidAmount,
          remaining: grandTotal - paidAmount,
          status: isPaid ? 'PAID' : isPartial ? 'PARTIAL' : dueDate.isBefore(dayjs()) ? 'OVERDUE' : 'UNPAID',
          payments: paidAmount > 0 ? {
            create: [{
              amount: paidAmount,
              payment_date: orderDate.add(15, 'day').toDate(),
              method: 'BANK_TRANSFER',
              reference: `TT-${orderCode}`,
            }],
          } : undefined,
        },
      });
    }
  }

  // Purchase Orders
  const poStatuses = ['NEW', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'] as const;

  for (let i = 0; i < 15; i++) {
    const supplier = suppliers[i % suppliers.length];
    const status = poStatuses[i % poStatuses.length];
    const orderDate = dayjs().subtract(Math.floor(Math.random() * 60), 'day');
    // Some orders with expected delivery in the past (to trigger overdue alerts)
    const daysOffset = i < 5 ? -Math.floor(Math.random() * 10) : Math.floor(Math.random() * 14);
    const expectedDelivery = dayjs().add(daysOffset, 'day');
    const orderCode = `PO-${orderDate.format('YYYYMMDD')}-${String(i + 1).padStart(3, '0')}`;

    const product = products[i % products.length];
    const qty = (1 + Math.floor(Math.random() * 20)) * 100;
    const price = ((product.retail_price as number | null) || 1000) * 0.6;
    const total = qty * price;

    const order = await prisma.purchaseOrder.upsert({
      where: { order_code: orderCode },
      update: {},
      create: {
        order_code: orderCode,
        supplier_id: supplier.id,
        order_date: orderDate.toDate(),
        expected_delivery: expectedDelivery.toDate(),
        total,
        status,
        items: {
          create: [{
            product_id: product.id,
            quantity: qty,
            unit_price: price,
            line_total: total,
          }],
        },
      },
    });

    // Create payable for confirmed+ orders
    if (['CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED'].includes(status)) {
      const dueDate = orderDate.add(30, 'day');
      const isPaid = status === 'COMPLETED';
      const paidAmount = isPaid ? total : 0;

      await prisma.payable.create({
        data: {
          purchase_order_id: order.id,
          supplier_id: supplier.id,
          invoice_number: `PI-${orderCode}`,
          invoice_date: orderDate.toDate(),
          due_date: dueDate.toDate(),
          original_amount: total,
          paid_amount: paidAmount,
          remaining: total - paidAmount,
          status: isPaid ? 'PAID' : dueDate.isBefore(dayjs()) ? 'OVERDUE' : 'UNPAID',
        },
      });
    }
  }
}
