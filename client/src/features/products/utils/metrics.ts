import dayjs from 'dayjs';

export interface OrderItemLite {
  quantity?: number;
  unit_price?: number;
  line_total?: number;
  sales_order?: { id?: string; order_date?: string; customer?: { id?: string; company_name?: string; contact_name?: string } };
  purchase_order?: { id?: string; order_date?: string; supplier?: { id?: string; company_name?: string } };
}

export interface SupplierPriceLite {
  id: string;
  purchase_price?: number;
  is_preferred?: boolean;
  lead_time_days?: number;
  moq?: number;
  supplier?: { id?: string; company_name?: string };
}

export interface HistoryStats {
  totalQty: number;
  totalAmount: number;
  avgPrice: number;
  topPartnerName: string | null;
  topPartnerQty: number;
  topPartnerOrderCount: number;
  totalPartners: number;
  spark: number[];
}

export function aggregateHistory(items: OrderItemLite[], partnerKey: 'sales_order' | 'purchase_order'): HistoryStats {
  let totalQty = 0;
  let totalAmount = 0;
  const partnerCount: Record<string, { name: string; qty: number; orders: number }> = {};

  for (const it of items) {
    const qty = it.quantity || 0;
    totalQty += qty;
    totalAmount += it.line_total || 0;
    const order = it[partnerKey] as any;
    const partner = partnerKey === 'sales_order' ? order?.customer : order?.supplier;
    const id = partner?.id || 'unknown';
    const name = partner?.company_name || partner?.contact_name || '—';
    if (!partnerCount[id]) partnerCount[id] = { name, qty: 0, orders: 0 };
    partnerCount[id].qty += qty;
    partnerCount[id].orders += 1;
  }

  const top = Object.values(partnerCount).sort((a, b) => b.qty - a.qty)[0];

  return {
    totalQty,
    totalAmount,
    avgPrice: totalQty > 0 ? Math.round(totalAmount / totalQty) : 0,
    topPartnerName: top?.name ?? null,
    topPartnerQty: top?.qty ?? 0,
    topPartnerOrderCount: top?.orders ?? 0,
    totalPartners: Object.keys(partnerCount).length,
    spark: buildSparkline(items, partnerKey),
  };
}

function buildSparkline(items: OrderItemLite[], partnerKey: 'sales_order' | 'purchase_order'): number[] {
  const buckets = 12;
  const dates = items
    .map(it => (it[partnerKey] as any)?.order_date)
    .filter(Boolean)
    .map(d => dayjs(d));
  if (!dates.length) return new Array(buckets).fill(0);
  const min = dates.reduce((a, b) => (a.isBefore(b) ? a : b));
  const max = dates.reduce((a, b) => (a.isAfter(b) ? a : b));
  const span = Math.max(1, max.diff(min, 'day'));
  const step = Math.max(1, span / buckets);
  const out = new Array(buckets).fill(0);
  for (const it of items) {
    const d = (it[partnerKey] as any)?.order_date;
    if (!d) continue;
    const idx = Math.min(buckets - 1, Math.floor(dayjs(d).diff(min, 'day') / step));
    out[idx] += it.quantity || 0;
  }
  return out;
}

export interface SupplierMetrics {
  best: SupplierPriceLite | null;
  preferred: SupplierPriceLite | null;
  marginVsRetailPct: number | null;
  bestVsPreferredPct: number | null;
}

export function computeSupplierMetrics(prices: SupplierPriceLite[], retailPrice?: number | null): SupplierMetrics {
  const valid = prices.filter(p => typeof p.purchase_price === 'number' && p.purchase_price! > 0);
  if (!valid.length) return { best: null, preferred: null, marginVsRetailPct: null, bestVsPreferredPct: null };
  const best = valid.reduce((a, b) => (a.purchase_price! < b.purchase_price! ? a : b));
  const preferred = valid.find(p => p.is_preferred) ?? null;
  const marginVsRetailPct = retailPrice && retailPrice > 0 && best.purchase_price
    ? Math.round(((retailPrice - best.purchase_price) / retailPrice) * 1000) / 10
    : null;
  const bestVsPreferredPct = preferred && best.id !== preferred.id && preferred.purchase_price
    ? Math.round(((preferred.purchase_price - best.purchase_price!) / preferred.purchase_price) * 1000) / 10
    : null;
  return { best, preferred, marginVsRetailPct, bestVsPreferredPct };
}

export function sparklinePath(values: number[], width = 100, height = 28): { line: string; area: string } {
  if (!values.length) return { line: '', area: '' };
  const max = Math.max(1, ...values);
  const stepX = width / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y.toFixed(1)}`;
  });
  const line = points.join(' ');
  const area = `${points.join(' ')} ${width},${height} 0,${height}`;
  return { line, area };
}

export function abbreviateNumber(n: number): { value: string; unit: string } {
  if (n >= 1_000_000) return { value: (n / 1_000_000).toFixed(1).replace(/\.0$/, ''), unit: 'M' };
  if (n >= 1_000) return { value: (n / 1_000).toFixed(1).replace(/\.0$/, ''), unit: 'k' };
  return { value: String(n), unit: '' };
}

export function formatVNDShort(n: number): { value: string; unit: string } {
  if (n >= 1_000_000) return { value: (n / 1_000_000).toFixed(2).replace(/\.?0+$/, ''), unit: 'M VND' };
  if (n >= 1_000) return { value: (n / 1_000).toFixed(1).replace(/\.0$/, ''), unit: 'k VND' };
  return { value: String(Math.round(n)), unit: 'VND' };
}
