import XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';

export interface LedgerRowInput {
  date: Date;
  doc_code: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  unit?: string;
  quantity?: number;
  unit_price?: number;
}

export interface LedgerExcelOptions {
  title: string;
  subtitle: string;
  nameRowLabel: string;
  accountCode: string;
  sheetName: string;
  rows: LedgerRowInput[];
  opening_balance: number;
  totals: { total_debit: number; total_credit: number; total_quantity: number; ending_balance: number };
  headerLabels: {
    docDate: string; docNumber: string; description: string; account: string;
    debit: string; credit: string; balanceDebit: string; balanceCredit: string;
    unit: string; quantity: string; unitPrice: string;
    subConverted: string; openingBalance: string; subtotal: string; total: string;
  };
}

const FONT = 'Times New Roman';
const THIN = { style: 'thin' as const, color: { rgb: '000000' } };
const ALL_BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const NUM_FMT = '#,##0';

const styles = {
  title: {
    font: { name: FONT, bold: true, sz: 16 },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  },
  subtitle: {
    font: { name: FONT, italic: true, sz: 12 },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  },
  headerCell: {
    font: { name: FONT, bold: true, sz: 12 },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'F0F0F0' } },
    border: ALL_BORDERS,
  },
  nameRow: {
    font: { name: FONT, bold: true, italic: true, sz: 13 },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'E6E6E6' } },
    border: ALL_BORDERS,
  },
  openingLabel: {
    font: { name: FONT, bold: true, sz: 11 },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'FAFAFA' } },
    border: ALL_BORDERS,
  },
  openingNum: {
    font: { name: FONT, bold: true, sz: 11 },
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'FAFAFA' } },
    border: ALL_BORDERS,
    numFmt: NUM_FMT,
  },
  openingCell: {
    font: { name: FONT, sz: 11 },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'FAFAFA' } },
    border: ALL_BORDERS,
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  },
  bodyText: {
    font: { name: FONT, sz: 11 },
    border: ALL_BORDERS,
    alignment: { vertical: 'center' as const, wrapText: true },
  },
  bodyCenter: {
    font: { name: FONT, sz: 11 },
    border: ALL_BORDERS,
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  },
  bodyNum: {
    font: { name: FONT, sz: 11 },
    border: ALL_BORDERS,
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
    numFmt: NUM_FMT,
  },
  totalLabel: {
    font: { name: FONT, bold: true, sz: 12 },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'FAFAFA' } },
    border: ALL_BORDERS,
  },
  totalCenter: {
    font: { name: FONT, bold: true, sz: 12 },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'FAFAFA' } },
    border: ALL_BORDERS,
  },
  totalNum: {
    font: { name: FONT, bold: true, sz: 12 },
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'FAFAFA' } },
    border: ALL_BORDERS,
    numFmt: NUM_FMT,
  },
  endingHighlight: {
    font: { name: FONT, bold: true, sz: 12 },
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'FFF3CD' } },
    border: ALL_BORDERS,
    numFmt: NUM_FMT,
  },
  grandTotalLabel: {
    font: { name: FONT, bold: true, sz: 13 },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'F5F5F5' } },
    border: ALL_BORDERS,
  },
  grandTotalNum: {
    font: { name: FONT, bold: true, sz: 13 },
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
    fill: { patternType: 'solid' as const, fgColor: { rgb: 'F5F5F5' } },
    border: ALL_BORDERS,
    numFmt: NUM_FMT,
  },
  empty: { font: { name: FONT, sz: 11 } },
};

function cell(value: unknown, style: Record<string, unknown>, type: 'string' | 'number' = 'string') {
  if (value === null || value === undefined || value === '') {
    return { v: '', t: 's', s: style };
  }
  return { v: value, t: type === 'number' ? 'n' : 's', s: style };
}

function setRow(ws: XLSX.WorkSheet, rowIdx: number, cells: Array<{ v: unknown; t: string; s: Record<string, unknown> }>) {
  cells.forEach((c, colIdx) => {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
    ws[addr] = c;
  });
}

export function buildLedgerWorkbook(opts: LedgerExcelOptions): Buffer {
  const { headerLabels: L } = opts;
  const COLS = 11;
  const ws: XLSX.WorkSheet = {};

  // Row 0: Title
  setRow(ws, 0, Array.from({ length: COLS }, (_, i) => cell(i === 0 ? opts.title : '', styles.title)));

  // Row 1: Subtitle
  setRow(ws, 1, Array.from({ length: COLS }, (_, i) => cell(i === 0 ? opts.subtitle : '', styles.subtitle)));

  // Row 2: blank
  setRow(ws, 2, Array.from({ length: COLS }, () => cell('', styles.empty)));

  // Row 3-4: Header (2 rows, merged non-amount columns)
  setRow(ws, 3, [
    cell(L.docDate, styles.headerCell), cell(L.docNumber, styles.headerCell),
    cell(L.description, styles.headerCell), cell(L.account, styles.headerCell),
    cell(L.debit, styles.headerCell), cell(L.credit, styles.headerCell),
    cell(L.balanceDebit, styles.headerCell), cell(L.balanceCredit, styles.headerCell),
    cell(L.unit, styles.headerCell), cell(L.quantity, styles.headerCell), cell(L.unitPrice, styles.headerCell),
  ]);
  setRow(ws, 4, [
    cell('', styles.headerCell), cell('', styles.headerCell),
    cell('', styles.headerCell), cell('', styles.headerCell),
    cell(L.subConverted, styles.headerCell), cell(L.subConverted, styles.headerCell),
    cell(L.subConverted, styles.headerCell), cell(L.subConverted, styles.headerCell),
    cell('', styles.headerCell), cell('', styles.headerCell), cell('', styles.headerCell),
  ]);

  // Row 5: Customer/Supplier name
  setRow(ws, 5, Array.from({ length: COLS }, (_, i) => cell(i === 0 ? opts.nameRowLabel : '', styles.nameRow)));

  // Row 6: Opening balance (always show 0 if zero, not blank)
  setRow(ws, 6, [
    cell('', styles.openingCell), cell('', styles.openingCell),
    cell(L.openingBalance, styles.openingLabel),
    cell(opts.accountCode, styles.openingCell),
    cell('', styles.openingCell), cell('', styles.openingCell),
    cell(opts.opening_balance >= 0 ? opts.opening_balance : '', styles.openingNum, 'number'),
    cell(opts.opening_balance < 0 ? -opts.opening_balance : '', styles.openingNum, 'number'),
    cell('', styles.openingCell), cell('', styles.openingCell), cell('', styles.openingCell),
  ]);

  // Data rows
  let rowIdx = 7;
  for (const r of opts.rows) {
    setRow(ws, rowIdx, [
      cell(dayjs(r.date).format('DD/MM/YYYY'), styles.bodyCenter),
      cell(r.doc_code, styles.bodyText),
      cell(r.description, styles.bodyText),
      cell(opts.accountCode, styles.bodyCenter),
      cell(r.debit || '', styles.bodyNum, 'number'),
      cell(r.credit || '', styles.bodyNum, 'number'),
      cell(r.balance > 0 ? r.balance : '', styles.bodyNum, 'number'),
      cell(r.balance < 0 ? -r.balance : '', styles.bodyNum, 'number'),
      cell(r.unit || '', styles.bodyCenter),
      cell(r.quantity || '', styles.bodyNum, 'number'),
      cell(r.unit_price || '', styles.bodyNum, 'number'),
    ]);
    rowIdx++;
  }

  // Subtotal (Cộng)
  const endingDr = opts.totals.ending_balance > 0 ? opts.totals.ending_balance : '';
  const endingCr = opts.totals.ending_balance < 0 ? -opts.totals.ending_balance : '';
  setRow(ws, rowIdx, [
    cell('', styles.totalCenter), cell('', styles.totalCenter),
    cell(L.subtotal, styles.totalLabel),
    cell(opts.accountCode, styles.totalCenter),
    cell(opts.totals.total_debit, styles.totalNum, 'number'),
    cell(opts.totals.total_credit, styles.totalNum, 'number'),
    cell(endingDr, endingDr !== '' ? styles.endingHighlight : styles.totalNum, 'number'),
    cell(endingCr, styles.totalNum, 'number'),
    cell('', styles.totalCenter),
    cell(opts.totals.total_quantity || '', styles.totalNum, 'number'),
    cell('', styles.totalCenter),
  ]);
  rowIdx++;

  // Grand total (Tổng cộng)
  setRow(ws, rowIdx, [
    cell('', styles.grandTotalLabel), cell('', styles.grandTotalLabel),
    cell(L.total, styles.grandTotalLabel),
    cell('', styles.grandTotalLabel),
    cell(opts.totals.total_debit, styles.grandTotalNum, 'number'),
    cell(opts.totals.total_credit, styles.grandTotalNum, 'number'),
    cell('', styles.grandTotalLabel), cell('', styles.grandTotalLabel),
    cell('', styles.grandTotalLabel),
    cell(opts.totals.total_quantity || '', styles.grandTotalNum, 'number'),
    cell('', styles.grandTotalLabel),
  ]);
  rowIdx++;

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIdx - 1, c: COLS - 1 } });

  ws['!cols'] = [
    { wch: 13 }, { wch: 14 }, { wch: 40 }, { wch: 11 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 8 }, { wch: 12 }, { wch: 13 },
  ];

  ws['!rows'] = [
    { hpt: 30 }, { hpt: 24 }, { hpt: 10 },
    { hpt: 24 }, { hpt: 24 },
    { hpt: 24 }, { hpt: 24 },
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
    { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
    { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
    { s: { r: 3, c: 3 }, e: { r: 4, c: 3 } },
    { s: { r: 3, c: 8 }, e: { r: 4, c: 8 } },
    { s: { r: 3, c: 9 }, e: { r: 4, c: 9 } },
    { s: { r: 3, c: 10 }, e: { r: 4, c: 10 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: COLS - 1 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName);

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}
