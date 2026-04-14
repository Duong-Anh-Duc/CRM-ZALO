import dayjs from 'dayjs';

const DEFAULT_COMPANY = {
  name: 'CONG TY TNHH TECHLA AI',
  address: 'Tang 8, Toa nha Licogi, so 164 Khuat Duy Tien, Thanh Xuan, Ha Noi',
  phone: '0868287651',
  email: 'admin@techlaai.com',
};

interface DebtReportData {
  type: 'receivable' | 'payable';
  entity: { name: string; phone: string; email: string; address: string };
  summary: { total_original: number; total_paid: number; total_remaining: number };
  invoices: {
    invoice_number: string; order_code: string; invoice_date: string;
    due_date: string; original_amount: number; paid_amount: number;
    remaining: number; status: string;
  }[];
  payments: {
    payment_date: string; invoice_number: string; amount: number;
    method: string; reference: string;
  }[];
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

const STATUS_MAP: Record<string, string> = {
  UNPAID: 'Chua thanh toan',
  PARTIAL: 'Thanh toan mot phan',
  PAID: 'Da thanh toan',
  OVERDUE: 'Qua han',
};

export function buildDebtReportHtml(data: DebtReportData): string {
  const isReceivable = data.type === 'receivable';
  const title = isReceivable ? 'BAO CAO CONG NO PHAI THU' : 'BAO CAO CONG NO PHAI TRA';
  const entityLabel = isReceivable ? 'Khach hang' : 'Nha cung cap';
  const now = dayjs().format('DD/MM/YYYY HH:mm');

  const invoiceRows = data.invoices.map((inv, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${inv.invoice_number}</td>
      <td>${inv.order_code}</td>
      <td style="text-align:center">${inv.invoice_date}</td>
      <td style="text-align:center">${inv.due_date}</td>
      <td style="text-align:right">${formatMoney(inv.original_amount)}</td>
      <td style="text-align:right">${formatMoney(inv.paid_amount)}</td>
      <td style="text-align:right;font-weight:600;color:${inv.remaining > 0 ? '#cf1322' : '#389e0d'}">${formatMoney(inv.remaining)}</td>
      <td style="text-align:center"><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:${inv.status === 'PAID' ? '#f6ffed' : inv.status === 'OVERDUE' ? '#fff2f0' : '#e6f4ff'};color:${inv.status === 'PAID' ? '#389e0d' : inv.status === 'OVERDUE' ? '#cf1322' : '#1677ff'}">${STATUS_MAP[inv.status] || inv.status}</span></td>
    </tr>
  `).join('');

  const paymentRows = data.payments.map((p, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center">${p.payment_date}</td>
      <td>${p.invoice_number}</td>
      <td style="text-align:right">${formatMoney(p.amount)}</td>
      <td>${p.method}</td>
      <td>${p.reference}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #333; line-height: 1.5; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1677ff; padding-bottom: 12px; }
  .header .company { font-size: 15px; font-weight: 700; color: #1677ff; }
  .header .info { font-size: 11px; color: #666; }
  .title { text-align: center; font-size: 20px; font-weight: 700; color: #1677ff; margin: 16px 0 8px; }
  .subtitle { text-align: center; font-size: 12px; color: #888; margin-bottom: 16px; }
  .entity-box { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
  .entity-box .label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
  .entity-box .value { font-weight: 600; font-size: 14px; }
  .entity-row { display: flex; gap: 20px; margin-top: 6px; font-size: 12px; color: #555; }
  .summary-row { display: flex; gap: 12px; margin-bottom: 16px; }
  .summary-card { flex: 1; background: #f0f5ff; border: 1px solid #d6e4ff; border-radius: 8px; padding: 10px 14px; text-align: center; }
  .summary-card.danger { background: #fff2f0; border-color: #ffccc7; }
  .summary-card.success { background: #f6ffed; border-color: #b7eb8f; }
  .summary-card .s-label { font-size: 11px; color: #666; }
  .summary-card .s-value { font-size: 16px; font-weight: 700; }
  .summary-card .s-value.blue { color: #1677ff; }
  .summary-card .s-value.green { color: #389e0d; }
  .summary-card .s-value.red { color: #cf1322; }
  .section-title { font-size: 14px; font-weight: 600; color: #333; margin: 16px 0 8px; border-left: 3px solid #1677ff; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1677ff; color: #fff; font-size: 11px; font-weight: 600; padding: 6px 8px; text-align: left; }
  td { padding: 5px 8px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
  tr:nth-child(even) { background: #fafafa; }
  .footer { margin-top: 20px; text-align: right; font-size: 11px; color: #999; border-top: 1px solid #e8e8e8; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${DEFAULT_COMPANY.name}</div>
    <div class="info">${DEFAULT_COMPANY.address}</div>
    <div class="info">DT: ${DEFAULT_COMPANY.phone} | Email: ${DEFAULT_COMPANY.email}</div>
  </div>

  <div class="title">${title}</div>
  <div class="subtitle">Ngay xuat: ${now}</div>

  <div class="entity-box">
    <div class="label">${entityLabel}</div>
    <div class="value">${data.entity.name}</div>
    <div class="entity-row">
      ${data.entity.phone ? `<span>DT: ${data.entity.phone}</span>` : ''}
      ${data.entity.email ? `<span>Email: ${data.entity.email}</span>` : ''}
    </div>
    ${data.entity.address ? `<div style="font-size:12px;color:#555;margin-top:4px">Dia chi: ${data.entity.address}</div>` : ''}
  </div>

  <div class="summary-row">
    <div class="summary-card">
      <div class="s-label">Tong cong no</div>
      <div class="s-value blue">${formatMoney(data.summary.total_original)} VND</div>
    </div>
    <div class="summary-card success">
      <div class="s-label">Da thanh toan</div>
      <div class="s-value green">${formatMoney(data.summary.total_paid)} VND</div>
    </div>
    <div class="summary-card${data.summary.total_remaining > 0 ? ' danger' : ' success'}">
      <div class="s-label">Con lai</div>
      <div class="s-value ${data.summary.total_remaining > 0 ? 'red' : 'green'}">${formatMoney(data.summary.total_remaining)} VND</div>
    </div>
  </div>

  <div class="section-title">Danh sach hoa don (${data.invoices.length})</div>
  <table>
    <thead>
      <tr>
        <th style="width:35px;text-align:center">STT</th>
        <th>So HD</th>
        <th>Ma don</th>
        <th style="text-align:center">Ngay HD</th>
        <th style="text-align:center">Han TT</th>
        <th style="text-align:right">Goc</th>
        <th style="text-align:right">Da TT</th>
        <th style="text-align:right">Con lai</th>
        <th style="text-align:center">Trang thai</th>
      </tr>
    </thead>
    <tbody>
      ${invoiceRows || '<tr><td colspan="9" style="text-align:center;color:#999">Khong co hoa don</td></tr>'}
    </tbody>
  </table>

  ${data.payments.length > 0 ? `
  <div class="section-title">Lich su thanh toan (${data.payments.length})</div>
  <table>
    <thead>
      <tr>
        <th style="width:35px;text-align:center">STT</th>
        <th style="text-align:center">Ngay TT</th>
        <th>So HD</th>
        <th style="text-align:right">So tien</th>
        <th>Phuong thuc</th>
        <th>Tham chieu</th>
      </tr>
    </thead>
    <tbody>
      ${paymentRows}
    </tbody>
  </table>
  ` : ''}

  <div class="footer">
    Xuat boi PackFlow CRM &mdash; ${now}
  </div>
</body>
</html>`;
}
