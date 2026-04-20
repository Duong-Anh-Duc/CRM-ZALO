import dayjs from 'dayjs';
import { createT } from '../../locales';

const DEFAULT_COMPANY = {
  name: 'CÔNG TY TNHH TECHLA AI',
  address: 'Tầng 8, Toà nhà Licogi, số 164 Khuất Duy Tiến, Thanh Xuân, Hà Nội',
  phone: '0868287651',
  email: 'admin@techlaai.com',
};

export interface LedgerReportData {
  type: 'receivable' | 'payable';
  entityName: string;
  rows: {
    date: Date | string;
    doc_code: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    unit?: string;
    quantity?: number;
    unit_price?: number;
  }[];
  opening_balance: number;
  totals: { total_debit: number; total_credit: number; total_quantity: number; ending_balance: number };
  from_date?: string;
  to_date?: string;
  lang?: string;
}

function formatMoney(n: number): string {
  if (!n) return '';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

function formatMoneyAllowZero(n: number): string {
  if (n === null || n === undefined) return '0';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

function escape(s: string): string {
  return String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c));
}

export function buildLedgerReportHtml(data: LedgerReportData): string {
  const tr = createT(data.lang || 'vi');
  const isReceivable = data.type === 'receivable';
  const acct = isReceivable ? '131' : '331';
  const title = tr(isReceivable ? 'ledger.receivableTitle' : 'ledger.payableTitle');
  const periodText = data.from_date && data.to_date
    ? tr('ledger.periodRange', { from: dayjs(data.from_date).format('DD/MM/YYYY'), to: dayjs(data.to_date).format('DD/MM/YYYY') })
    : tr('ledger.periodAll');
  const subtitle = tr(isReceivable ? 'ledger.subtitleReceivable' : 'ledger.subtitlePayable', {
    name: data.entityName,
    period: periodText,
  });
  const nameRowLabel = tr(isReceivable ? 'ledger.rowCustomerName' : 'ledger.rowSupplierName', { name: data.entityName });
  const now = dayjs().format('DD/MM/YYYY HH:mm');

  const ledgerRows = data.rows.map((r) => {
    const debitStr = r.debit > 0 ? formatMoney(r.debit) : '';
    const creditStr = r.credit > 0 ? formatMoney(r.credit) : '';
    const drBalance = r.balance > 0 ? formatMoney(r.balance) : '';
    const crBalance = r.balance < 0 ? formatMoney(-r.balance) : '';
    return `
      <tr>
        <td style="text-align:center">${dayjs(r.date).format('DD/MM/YYYY')}</td>
        <td>${escape(r.doc_code)}</td>
        <td>${escape(r.description)}</td>
        <td style="text-align:center">${acct}</td>
        <td class="num">${debitStr}</td>
        <td class="num">${creditStr}</td>
        <td class="num">${drBalance}</td>
        <td class="num">${crBalance}</td>
        <td style="text-align:center">${escape(r.unit || '')}</td>
        <td class="num">${r.quantity ? r.quantity.toLocaleString('vi-VN') : ''}</td>
        <td class="num">${r.unit_price ? formatMoney(r.unit_price) : ''}</td>
      </tr>
    `;
  }).join('');

  const drEnding = data.totals.ending_balance >= 0 ? formatMoneyAllowZero(data.totals.ending_balance) : '';
  const crEnding = data.totals.ending_balance < 0 ? formatMoney(-data.totals.ending_balance) : '';
  const drOpening = data.opening_balance >= 0 ? formatMoneyAllowZero(data.opening_balance) : '';
  const crOpening = data.opening_balance < 0 ? formatMoney(-data.opening_balance) : '';

  return `<!DOCTYPE html>
<html lang="${data.lang || 'vi'}">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', 'Times', serif; font-size: 13px; color: #000; line-height: 1.45; padding: 16px 12px; }
  .company-head { text-align: center; margin-bottom: 8px; }
  .company-head .name { font-size: 13px; font-weight: 700; }
  .company-head .info { font-size: 11px; color: #444; }
  .title { text-align: center; font-size: 18px; font-weight: 700; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .subtitle { text-align: center; font-size: 13px; font-style: italic; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 5px 6px; font-size: 12px; word-wrap: break-word; vertical-align: middle; }
  th { background: #f0f0f0; font-weight: 700; text-align: center; font-size: 12px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.name-row td { background: #e6e6e6; font-weight: 700; font-style: italic; font-size: 13px; }
  tr.opening td { background: #fafafa; font-weight: 700; }
  tr.subtotal td { background: #fafafa; font-weight: 700; }
  tr.subtotal td.ending { background: #fff3cd; font-weight: 700; }
  tr.total td { background: #f5f5f5; font-weight: 700; font-size: 13px; }
  .footer { margin-top: 14px; text-align: right; font-size: 10px; color: #888; font-style: italic; }
</style>
</head>
<body>
  <div class="company-head">
    <div class="name">${DEFAULT_COMPANY.name}</div>
    <div class="info">${DEFAULT_COMPANY.address} &bull; ĐT: ${DEFAULT_COMPANY.phone}</div>
  </div>

  <div class="title">${escape(title)}</div>
  <div class="subtitle">${escape(subtitle)}</div>

  <table>
    <colgroup>
      <col style="width:7%"><col style="width:8%"><col style="width:22%"><col style="width:5%">
      <col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:7%">
      <col style="width:5%"><col style="width:8%"><col style="width:11%">
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2">${tr('ledger.colDocDate')}</th>
        <th rowspan="2">${tr('ledger.colDocNumber')}</th>
        <th rowspan="2">${tr('ledger.colDescription')}</th>
        <th rowspan="2">${tr('ledger.colAccount')}</th>
        <th>${tr('ledger.colDebit')}</th>
        <th>${tr('ledger.colCredit')}</th>
        <th>${tr('ledger.colBalanceDebit')}</th>
        <th>${tr('ledger.colBalanceCredit')}</th>
        <th rowspan="2">${tr('ledger.colUnit')}</th>
        <th rowspan="2">${tr('ledger.colQuantity')}</th>
        <th rowspan="2">${tr('ledger.colUnitPrice')}</th>
      </tr>
      <tr>
        <th>${tr('ledger.subConverted')}</th>
        <th>${tr('ledger.subConverted')}</th>
        <th>${tr('ledger.subConverted')}</th>
        <th>${tr('ledger.subConverted')}</th>
      </tr>
    </thead>
    <tbody>
      <tr class="name-row"><td colspan="11">${escape(nameRowLabel)}</td></tr>
      <tr class="opening">
        <td></td><td></td><td>${tr('ledger.rowOpeningBalance')}</td><td style="text-align:center">${acct}</td>
        <td></td><td></td>
        <td class="num">${drOpening}</td>
        <td class="num">${crOpening}</td>
        <td></td><td></td><td></td>
      </tr>
      ${ledgerRows || `<tr><td colspan="11" style="text-align:center;color:#999;font-style:italic">—</td></tr>`}
      <tr class="subtotal">
        <td></td><td></td><td>${tr('ledger.rowSubtotal')}</td><td style="text-align:center">${acct}</td>
        <td class="num">${formatMoney(data.totals.total_debit)}</td>
        <td class="num">${formatMoney(data.totals.total_credit)}</td>
        <td class="num ending">${drEnding}</td>
        <td class="num">${crEnding}</td>
        <td></td>
        <td class="num">${data.totals.total_quantity ? data.totals.total_quantity.toLocaleString('vi-VN') : ''}</td>
        <td></td>
      </tr>
      <tr class="total">
        <td></td><td></td><td>${tr('ledger.rowTotal')}</td><td></td>
        <td class="num">${formatMoney(data.totals.total_debit)}</td>
        <td class="num">${formatMoney(data.totals.total_credit)}</td>
        <td></td><td></td><td></td>
        <td class="num">${data.totals.total_quantity ? data.totals.total_quantity.toLocaleString('vi-VN') : ''}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">PackFlow CRM &mdash; ${now}</div>
</body>
</html>`;
}
