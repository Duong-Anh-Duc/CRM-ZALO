import prisma from '../../lib/prisma';
import dayjs from 'dayjs';
import { AppError } from '../../middleware/error.middleware';
import { t, createT } from '../../locales';
import { buildLedgerWorkbook } from '../../lib/ledger-excel';
import type { LedgerRow, LedgerResult } from './receivable-ledger.types';

const UNIT_KEY: Record<string, string> = { PIECE: 'unitPiece', CARTON: 'unitCarton', KG: 'unitKg' };

export class ReceivableLedgerService {
  static async getCustomerLedger(customerId: string, fromDate?: string, toDate?: string, lang = 'vi'): Promise<LedgerResult> {
    const tr = createT(lang);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, company_name: true, contact_name: true, phone: true, email: true, address: true },
    });
    if (!customer) throw new AppError(t('customer.notFound'), 404);

    const receivables = await prisma.receivable.findMany({
      where: { customer_id: customerId },
      include: {
        sales_order: {
          select: {
            order_code: true, shipping_fee: true, other_fee: true, other_fee_note: true,
            items: {
              select: {
                quantity: true, unit_price: true, line_total: true, vat_amount: true,
                discount_pct: true, customer_product_name: true,
                product: { select: { name: true, sku: true, unit_of_sale: true } },
              },
            },
          },
        },
        payments: { orderBy: { payment_date: 'asc' } },
      },
      orderBy: { invoice_date: 'asc' },
    });

    const returns = await prisma.salesReturn.findMany({
      where: { customer_id: customerId, status: 'COMPLETED' },
      select: { return_code: true, return_date: true, total_amount: true, reason: true },
    });

    const entityName = customer.company_name || customer.contact_name || '';
    const allRows: LedgerRow[] = [];

    for (const rec of receivables) {
      const so = rec.sales_order;
      for (const item of so?.items || []) {
        const name = item.customer_product_name || item.product?.name || '-';
        const unit = tr(`ledger.${UNIT_KEY[item.product?.unit_of_sale || 'PIECE']}`);
        allRows.push({
          date: rec.invoice_date,
          doc_code: rec.invoice_number || '-',
          description: name,
          debit: Number(item.line_total),
          credit: 0,
          balance: 0,
          unit,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
        });
      }
      const totalVat = (so?.items || []).reduce((s, it) => s + Number(it.vat_amount || 0), 0);
      if (totalVat > 0) {
        allRows.push({
          date: rec.invoice_date,
          doc_code: rec.invoice_number || '-',
          description: tr('ledger.vat'),
          debit: totalVat,
          credit: 0,
          balance: 0,
          unit: tr('ledger.unitTime'),
          quantity: 1,
          unit_price: totalVat,
        });
      }
      if (so?.shipping_fee && Number(so.shipping_fee) > 0) {
        allRows.push({
          date: rec.invoice_date,
          doc_code: rec.invoice_number || '-',
          description: tr('ledger.shippingFee'),
          debit: Number(so.shipping_fee),
          credit: 0,
          balance: 0,
        });
      }
      if (so?.other_fee && Number(so.other_fee) > 0) {
        allRows.push({
          date: rec.invoice_date,
          doc_code: rec.invoice_number || '-',
          description: so.other_fee_note || tr('ledger.otherFee'),
          debit: Number(so.other_fee),
          credit: 0,
          balance: 0,
        });
      }
      for (const pay of rec.payments) {
        allRows.push({
          date: pay.payment_date,
          doc_code: pay.reference || `${tr('ledger.paymentPrefix')}-${pay.id.slice(0, 8)}`,
          description: tr('ledger.collectFrom', { name: entityName }),
          debit: 0,
          credit: Number(pay.amount),
          balance: 0,
        });
      }
    }

    for (const ret of returns) {
      allRows.push({
        date: ret.return_date,
        doc_code: ret.return_code,
        description: ret.reason ? `${tr('ledger.salesReturn')} - ${ret.reason}` : tr('ledger.salesReturn'),
        debit: 0,
        credit: Number(ret.total_amount),
        balance: 0,
      });
    }

    allRows.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      return a.credit - b.credit;
    });

    let runningBalance = 0;
    for (const row of allRows) {
      runningBalance += row.debit - row.credit;
      row.balance = runningBalance;
    }

    const fromD = fromDate ? dayjs(fromDate).startOf('day').toDate() : null;
    const toD = toDate ? dayjs(toDate).endOf('day').toDate() : null;

    const beforeRows = fromD ? allRows.filter((r) => r.date < fromD) : [];
    const openingBalance = beforeRows.length > 0 ? beforeRows[beforeRows.length - 1].balance : 0;

    const rows = allRows.filter((r) => {
      if (fromD && r.date < fromD) return false;
      if (toD && r.date > toD) return false;
      return true;
    });

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    const totalQty = rows.reduce((s, r) => s + (r.quantity || 0), 0);
    const endingBalance = openingBalance + totalDebit - totalCredit;

    // When no date range provided, compute actual range from data (first row → today)
    const effectiveFrom = fromDate
      ?? (allRows.length > 0 ? dayjs(allRows[0].date).format('YYYY-MM-DD') : undefined);
    const effectiveTo = toDate
      ?? (allRows.length > 0 ? dayjs().format('YYYY-MM-DD') : undefined);

    return {
      customer,
      rows,
      opening_balance: openingBalance,
      totals: { total_debit: totalDebit, total_credit: totalCredit, total_quantity: totalQty, ending_balance: endingBalance },
      from_date: effectiveFrom,
      to_date: effectiveTo,
    };
  }

  static async exportLedgerExcel(customerId: string, fromDate?: string, toDate?: string, lang = 'vi'): Promise<Buffer> {
    const tr = createT(lang);
    const { customer, rows, opening_balance, totals, from_date, to_date } = await this.getCustomerLedger(customerId, fromDate, toDate, lang);

    const entityName = customer.company_name || customer.contact_name || '';
    const periodText = from_date && to_date
      ? tr('ledger.periodRange', { from: dayjs(from_date).format('DD/MM/YYYY'), to: dayjs(to_date).format('DD/MM/YYYY') })
      : tr('ledger.periodAll');

    return buildLedgerWorkbook({
      title: tr('ledger.receivableTitle'),
      subtitle: tr('ledger.subtitleReceivable', { name: entityName, period: periodText }),
      nameRowLabel: tr('ledger.rowCustomerName', { name: entityName }),
      accountCode: '131',
      sheetName: tr('ledger.receivableSheetName'),
      rows,
      opening_balance,
      totals,
      headerLabels: {
        docDate: tr('ledger.colDocDate'),
        docNumber: tr('ledger.colDocNumber'),
        description: tr('ledger.colDescription'),
        account: tr('ledger.colAccount'),
        debit: tr('ledger.colDebit'),
        credit: tr('ledger.colCredit'),
        balanceDebit: tr('ledger.colBalanceDebit'),
        balanceCredit: tr('ledger.colBalanceCredit'),
        unit: tr('ledger.colUnit'),
        quantity: tr('ledger.colQuantity'),
        unitPrice: tr('ledger.colUnitPrice'),
        subConverted: tr('ledger.subConverted'),
        openingBalance: tr('ledger.rowOpeningBalance'),
        subtotal: tr('ledger.rowSubtotal'),
        total: tr('ledger.rowTotal'),
      },
    });
  }
}
