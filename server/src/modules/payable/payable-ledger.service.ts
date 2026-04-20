import prisma from '../../lib/prisma';
import dayjs from 'dayjs';
import { AppError } from '../../middleware/error.middleware';
import { t, createT } from '../../locales';
import { buildLedgerWorkbook } from '../../lib/ledger-excel';
import type { LedgerRow, LedgerResult } from './payable-ledger.types';

const UNIT_KEY: Record<string, string> = { PIECE: 'unitPiece', CARTON: 'unitCarton', KG: 'unitKg' };

export class PayableLedgerService {
  static async getSupplierLedger(supplierId: string, fromDate?: string, toDate?: string, lang = 'vi'): Promise<LedgerResult> {
    const tr = createT(lang);

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, company_name: true, contact_name: true, phone: true, email: true, address: true },
    });
    if (!supplier) throw new AppError(t('supplier.notFound'), 404);

    const payables = await prisma.payable.findMany({
      where: { supplier_id: supplierId },
      include: {
        purchase_order: {
          select: {
            order_code: true, shipping_fee: true, other_fee: true, other_fee_note: true,
            items: {
              select: {
                quantity: true, unit_price: true, line_total: true,
                product: { select: { name: true, sku: true, unit_of_sale: true } },
              },
            },
          },
        },
        payments: { orderBy: { payment_date: 'asc' } },
      },
      orderBy: { invoice_date: 'asc' },
    });

    const returns = await prisma.purchaseReturn.findMany({
      where: {
        purchase_order: { supplier_id: supplierId },
        status: 'COMPLETED',
      },
      select: { return_code: true, return_date: true, total_amount: true, reason: true },
    });

    const entityName = supplier.company_name;
    const allRows: LedgerRow[] = [];

    for (const pay of payables) {
      const po = pay.purchase_order;
      for (const item of po?.items || []) {
        const name = item.product?.name || '-';
        const unit = tr(`ledger.${UNIT_KEY[item.product?.unit_of_sale || 'PIECE']}`);
        allRows.push({
          date: pay.invoice_date,
          doc_code: pay.invoice_number || '-',
          description: name,
          debit: Number(item.line_total),
          credit: 0,
          balance: 0,
          unit,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
        });
      }
      if (po?.shipping_fee && Number(po.shipping_fee) > 0) {
        allRows.push({
          date: pay.invoice_date,
          doc_code: pay.invoice_number || '-',
          description: tr('ledger.shippingFee'),
          debit: Number(po.shipping_fee),
          credit: 0,
          balance: 0,
        });
      }
      if (po?.other_fee && Number(po.other_fee) > 0) {
        allRows.push({
          date: pay.invoice_date,
          doc_code: pay.invoice_number || '-',
          description: po.other_fee_note || tr('ledger.otherFee'),
          debit: Number(po.other_fee),
          credit: 0,
          balance: 0,
        });
      }
      for (const p of pay.payments) {
        allRows.push({
          date: p.payment_date,
          doc_code: p.reference || `${tr('ledger.paymentPrefix')}-${p.id.slice(0, 8)}`,
          description: tr('ledger.payTo', { name: entityName }),
          debit: 0,
          credit: Number(p.amount),
          balance: 0,
        });
      }
    }

    for (const ret of returns) {
      allRows.push({
        date: ret.return_date,
        doc_code: ret.return_code,
        description: ret.reason ? `${tr('ledger.purchaseReturn')} - ${ret.reason}` : tr('ledger.purchaseReturn'),
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

    const effectiveFrom = fromDate
      ?? (allRows.length > 0 ? dayjs(allRows[0].date).format('YYYY-MM-DD') : undefined);
    const effectiveTo = toDate
      ?? (allRows.length > 0 ? dayjs().format('YYYY-MM-DD') : undefined);

    return {
      supplier,
      rows,
      opening_balance: openingBalance,
      totals: { total_debit: totalDebit, total_credit: totalCredit, total_quantity: totalQty, ending_balance: endingBalance },
      from_date: effectiveFrom,
      to_date: effectiveTo,
    };
  }

  static async exportLedgerExcel(supplierId: string, fromDate?: string, toDate?: string, lang = 'vi'): Promise<Buffer> {
    const tr = createT(lang);
    const { supplier, rows, opening_balance, totals, from_date, to_date } = await this.getSupplierLedger(supplierId, fromDate, toDate, lang);

    const periodText = from_date && to_date
      ? tr('ledger.periodRange', { from: dayjs(from_date).format('DD/MM/YYYY'), to: dayjs(to_date).format('DD/MM/YYYY') })
      : tr('ledger.periodAll');

    return buildLedgerWorkbook({
      title: tr('ledger.payableTitle'),
      subtitle: tr('ledger.subtitlePayable', { name: supplier.company_name, period: periodText }),
      nameRowLabel: tr('ledger.rowSupplierName', { name: supplier.company_name }),
      accountCode: '331',
      sheetName: tr('ledger.payableSheetName'),
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
