interface InvoiceData {
  serial: string;
  number: number;
  date: string;
  cqtCode?: string;
  seller: {
    name: string;
    taxCode: string;
    address: string;
    phone: string;
    email: string;
    representative: string;
    position: string;
  };
  buyer: {
    contactName?: string;
    companyName: string;
    address: string;
    taxCode: string;
    paymentMethod: string;
    bankAccount?: string;
    cccd?: string;
    email?: string;
  };
  items: Array<{
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  totalInWords: string;
}

function fmt(n: number): string {
  return n.toLocaleString('vi-VN');
}

export function buildInvoiceHtml(data: InvoiceData): string {
  const itemRows = data.items.map((item, i) => `
    <tr>
      <td class="tc">${i + 1}</td>
      <td class="tl" style="padding:7px 8px;">${item.name}</td>
      <td class="tc">${item.unit}</td>
      <td class="tc">${fmt(item.quantity)}</td>
      <td class="tr">${fmt(item.unitPrice)}</td>
      <td class="tr">${fmt(item.amount)}</td>
    </tr>`).join('');

  const emptyCount = Math.max(0, 6 - data.items.length);
  const emptyRows = Array(emptyCount).fill('<tr><td class="tc">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('');

  // Watermark SVG
  const cx = 340, cy = 480;
  let wm = '';
  for (let r = 10; r <= 180; r += 4) {
    const op = r < 30 ? 0.10 : r < 70 ? 0.08 : r < 120 ? 0.06 : 0.04;
    const sw = r < 40 ? 1.2 : r < 90 ? 0.8 : 0.5;
    wm += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2e6eb5" stroke-width="${sw}" opacity="${op}"/>`;
  }
  for (let a = 0; a < 360; a += 8) {
    const rad = a * Math.PI / 180;
    wm += `<line x1="${cx + Math.cos(rad) * 15}" y1="${cy + Math.sin(rad) * 15}" x2="${cx + Math.cos(rad) * 170}" y2="${cy + Math.sin(rad) * 170}" stroke="#2e6eb5" stroke-width="0.3" opacity="0.03"/>`;
  }
  for (let a = 0; a < 360; a += 30) {
    const rad = a * Math.PI / 180;
    wm += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(rad) * 50}" y2="${cy + Math.sin(rad) * 50}" stroke="#2e6eb5" stroke-width="1.2" opacity="0.06"/>`;
  }

  // Border decoration dots
  let bd = '';
  for (let x = 14; x < 666; x += 5) {
    bd += `<rect x="${x}" y="9.5" width="2.5" height="2.5" fill="#2e6eb5" opacity="0.2" rx="0.5"/>`;
    bd += `<rect x="${x}" y="948" width="2.5" height="2.5" fill="#2e6eb5" opacity="0.2" rx="0.5"/>`;
  }
  for (let y = 14; y < 948; y += 5) {
    bd += `<rect x="9.5" y="${y}" width="2.5" height="2.5" fill="#2e6eb5" opacity="0.2" rx="0.5"/>`;
    bd += `<rect x="668" y="${y}" width="2.5" height="2.5" fill="#2e6eb5" opacity="0.2" rx="0.5"/>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Times New Roman', Times, serif;
  font-size: 13px;
  color: #000;
  width: 210mm;
  height: 297mm;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
.page {
  width: 180mm;
  position: relative;
  padding: 18mm 12mm 12mm 12mm;
}
.tc { text-align: center; padding: 6px 4px; }
.tl { text-align: left; }
.tr { text-align: right; padding: 6px 8px; }

/* Header */
.hdr { display: flex; align-items: flex-start; margin-bottom: 4px; }
.hdr-main { flex: 1; text-align: center; }
.hdr-main h1 { font-size: 18px; font-weight: bold; color: #008000; letter-spacing: 1.5px; margin: 0; white-space: nowrap; }
.hdr-main .s1 { font-size: 13px; font-style: italic; color: #222; margin: 1px 0; }
.hdr-main .s2 { font-size: 12px; margin: 2px 0; }
.hdr-right { width: 140px; text-align: right; flex-shrink: 0; padding-top: 8px; font-size: 12px; }
.hdr-right .sn { font-size: 14px; font-weight: bold; display: block; }
.hdr-right .no { font-size: 20px; font-weight: bold; color: #cc0000; }
.hdr-right .en { font-style: italic; color: #666; font-size: 10.5px; }

.dateline { text-align: center; font-size: 13px; margin: 3px 0; }
.cqt { text-align: center; font-weight: bold; font-style: italic; font-size: 13px; margin: 4px 0 6px; }
hr.sep { border: none; border-top: 1.5px solid #222; margin: 0 0 8px 0; }

/* Info block */
.iblock { border: 1px solid #222; padding: 8px 12px; font-size: 13px; line-height: 1.55; }
.iblock + .iblock { border-top: none; }
.iblock .row { margin-bottom: 2px; }
.iblock .lb { font-weight: bold; }
.iblock .en { font-style: italic; color: #555; font-size: 11.5px; }
.iblock .green { color: #008000; font-size: 15px; font-weight: bold; }

/* Items table */
table.itbl { width: 100%; border-collapse: collapse; border: 1px solid #222; font-size: 12.5px; }
table.itbl th { background: #e6e6e6; border: 1px solid #222; padding: 4px 3px; text-align: center; font-weight: bold; font-size: 12px; }
table.itbl th .en { font-style: italic; font-weight: normal; display: block; font-size: 10.5px; color: #555; }
table.itbl td { border-left: 1px solid #222; border-right: 1px solid #222; border-bottom: 1px solid #bbb; font-size: 13px; }
table.itbl tbody tr:last-child td { border-bottom: 1px solid #222; }
.idx { text-align: center; font-style: italic; font-size: 10.5px; padding: 1px; border: 1px solid #222 !important; }

/* Totals */
.tots { border: 1px solid #222; border-top: none; font-size: 13px; }
.trow { display: flex; align-items: center; padding: 4px 8px; border-bottom: 1px solid #ddd; }
.trow:last-child { border-bottom: none; }
.trow .lb { flex: 1; text-align: right; font-weight: bold; padding-right: 12px; }
.trow .lb .en { font-style: italic; font-weight: normal; color: #555; font-size: 11.5px; }
.trow .vl { width: 140px; text-align: right; font-weight: bold; font-size: 13.5px; }
.trow.last { border-top: 1.5px solid #222; }
.trow.last .lb { font-size: 13.5px; }
.trow.last .vl { font-size: 15px; }

/* Words */
.wrd { border: 1px solid #222; border-top: none; padding: 6px 12px; font-size: 13px; }
.wrd .lb { font-weight: bold; }
.wrd .en { font-style: italic; color: #555; font-size: 11.5px; }
.wrd .v { font-style: italic; margin-left: 8px; }

/* Signatures */
.sigs { display: flex; justify-content: space-around; margin-top: 16px; text-align: center; }
.sig { width: 44%; }
.sig .t { font-weight: bold; font-size: 13.5px; }
.sig .n { font-style: italic; font-size: 11.5px; color: #555; margin: 2px 0; }
.sig .en { font-style: italic; font-size: 10.5px; color: #555; }
.sig .sp { height: 55px; }
.sig .name { font-weight: bold; font-size: 13px; }
</style></head>
<body>
<div class="page">
  <!-- SVG border + watermark -->
  <svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;">
    <rect x="5" y="5" width="calc(100% - 10px)" height="calc(100% - 10px)" rx="2" fill="none" stroke="#2e6eb5" stroke-width="4.5"/>
    <rect x="13" y="13" width="calc(100% - 26px)" height="calc(100% - 26px)" rx="1" fill="none" stroke="#2e6eb5" stroke-width="1.5"/>
    ${bd}
    ${wm}
  </svg>

  <!-- Header -->
  <div class="hdr">
    <div style="width:140px"></div>
    <div class="hdr-main">
      <h1>H\u00D3A \u0110\u01A0N GI\u00C1 TR\u1ECA GIA T\u0102NG</h1>
      <div class="s1">(VAT INVOICE)</div>
      <div class="s2">B\u1EA3n th\u1EC3 hi\u1EC7n c\u1EE7a h\u00F3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED</div>
      <div class="s1">(Electronic invoice display)</div>
    </div>
    <div class="hdr-right">
      <div>K\u00FD hi\u1EC7u <span class="en">(Serial No)</span>: <span class="sn">${data.serial}</span></div>
      <div>S\u1ED1 <span class="en">(No.)</span>: <span class="no">${data.number}</span></div>
    </div>
  </div>

  <div class="dateline">${data.date}</div>
  ${data.cqtCode ? `<div class="cqt">M\u00E3 CQT: ${data.cqtCode}</div>` : ''}
  <hr class="sep"/>

  <!-- Seller -->
  <div class="iblock">
    <div class="row"><span class="lb">\u0110\u01A1n v\u1ECB b\u00E1n h\u00E0ng</span> <span class="en">(Seller)</span>: <span class="green">${data.seller.name}</span></div>
    <div class="row"><span class="lb">M\u00E3 s\u1ED1 thu\u1EBF/M\u00E3 \u0111\u01A1n v\u1ECB quan h\u1EC7 ng\u00E2n s\u00E1ch</span> <span class="en">(Tax code)</span>: <strong>${data.seller.taxCode}</strong></div>
    <div class="row"><span class="lb">\u0110\u1ECBa ch\u1EC9</span> <span class="en">(Address)</span>: ${data.seller.address}</div>
    <div class="row"><span class="lb">\u0110i\u1EC7n tho\u1EA1i</span> <span class="en">(Tel)</span>: ${data.seller.phone} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span class="lb">Email</span>: ${data.seller.email}</div>
  </div>

  <!-- Buyer -->
  <div class="iblock">
    <div class="row"><span class="lb">H\u1ECD t\u00EAn ng\u01B0\u1EDDi mua h\u00E0ng</span> <span class="en">(Buyer's fullname)</span>: ${data.buyer.contactName || ''}</div>
    <div class="row"><span class="lb">T\u00EAn \u0111\u01A1n v\u1ECB</span> <span class="en">(Company's name)</span>: <strong>${data.buyer.companyName}</strong></div>
    <div class="row"><span class="lb">\u0110\u1ECBa ch\u1EC9</span> <span class="en">(Address)</span>: ${data.buyer.address}</div>
    <div class="row"><span class="lb">M\u00E3 s\u1ED1 thu\u1EBF/M\u00E3 \u0111\u01A1n v\u1ECB quan h\u1EC7 ng\u00E2n s\u00E1ch</span> <span class="en">(Tax code)</span>: ${data.buyer.taxCode}</div>
    <div class="row"><span class="lb">H\u00ECnh th\u1EE9c thanh to\u00E1n</span> <span class="en">(Payment method)</span>: ${data.buyer.paymentMethod}</div>
    <div class="row"><span class="lb">S\u1ED1 t\u00E0i kho\u1EA3n</span> <span class="en">(A/C No)</span>: ${data.buyer.bankAccount || ''}</div>
    <div class="row"><span class="lb">CCCD/H\u1ED9 chi\u1EBFu</span> <span class="en">(Citizen Identity Card/Passport Number)</span>: ${data.buyer.cccd || ''}</div>
    <div class="row"><span class="lb">Email</span>: ${data.buyer.email || ''}</div>
  </div>

  <!-- Items -->
  <table class="itbl">
    <thead>
      <tr>
        <th style="width:36px;">STT<span class="en">(No.)</span></th>
        <th>T\u00EAn h\u00E0ng h\u00F3a, d\u1ECBch v\u1EE5<span class="en">(Description)</span></th>
        <th style="width:72px;">\u0110\u01A1n v\u1ECB t\u00EDnh<span class="en">(Unit)</span></th>
        <th style="width:64px;">S\u1ED1 l\u01B0\u1EE3ng<span class="en">(Quantity)</span></th>
        <th style="width:100px;">\u0110\u01A1n gi\u00E1<span class="en">(Unit price)</span></th>
        <th style="width:110px;">Th\u00E0nh ti\u1EC1n<span class="en">(Amount)</span></th>
      </tr>
      <tr>
        <td class="idx">(1)</td><td class="idx">(2)</td><td class="idx">(3)</td><td class="idx">(4)</td><td class="idx">(5)</td><td class="idx">(6) = (4) x (5)</td>
      </tr>
    </thead>
    <tbody>${itemRows}${emptyRows}</tbody>
  </table>

  <!-- Totals -->
  <div class="tots">
    <div class="trow">
      <div class="lb">C\u1ED9ng ti\u1EC1n h\u00E0ng <span class="en">(Total amount)</span>:</div>
      <div class="vl">${fmt(data.subtotal)}</div>
    </div>
    <div class="trow">
      <div style="flex:1;">Thu\u1EBF su\u1EA5t GTGT <span class="en">(VAT Rate)</span>: ${data.vatRate}%</div>
      <div class="lb">Ti\u1EC1n thu\u1EBF GTGT <span class="en">(VAT amount)</span>:</div>
      <div class="vl">${fmt(data.vatAmount)}</div>
    </div>
    <div class="trow last">
      <div class="lb">T\u1ED5ng c\u1ED9ng ti\u1EC1n thanh to\u00E1n <span class="en">(Total payment)</span>:</div>
      <div class="vl">${fmt(data.total)}</div>
    </div>
  </div>

  <!-- Words -->
  <div class="wrd">
    <span class="lb">S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF</span> <span class="en">(In words)</span>:
    <span class="v">${data.totalInWords}</span>
  </div>

  <!-- Signatures -->
  <div class="sigs">
    <div class="sig">
      <div class="t">Ng\u01B0\u1EDDi mua h\u00E0ng <span class="en">(Buyer)</span></div>
      <div class="n">(K\u00FD, ghi r\u00F5 h\u1ECD t\u00EAn)</div>
      <div class="en">(Sign & Fullname)</div>
      <div class="sp"></div>
    </div>
    <div class="sig">
      <div class="t">Ng\u01B0\u1EDDi b\u00E1n h\u00E0ng <span class="en">(Seller)</span></div>
      <div class="n">(K\u00FD, ghi r\u00F5 h\u1ECD t\u00EAn)</div>
      <div class="en">(Sign & Fullname)</div>
      <div class="sp"></div>
      <div class="name">${data.seller.representative}</div>
    </div>
  </div>
</div>
</body></html>`;
}

export type { InvoiceData };
