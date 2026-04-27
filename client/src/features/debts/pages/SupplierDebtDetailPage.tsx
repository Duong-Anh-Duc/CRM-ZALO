import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Empty, Table, Button, Input, Switch, Tooltip, Modal, DatePicker, Progress } from 'antd';
import { DollarOutlined, SearchOutlined, UnorderedListOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { useSupplierDebtDetail } from '../hooks';
import { payableApi } from '../api';
import { formatVND, formatDate } from '@/utils/format';
import { PaymentModal, ExportLedgerModal } from '@/components/common';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { usePermission } from '@/contexts/AbilityContext';
import { formatVNDShort, getInitials } from '@/features/customers/utils/metrics';
import '@/features/products/styles/productDetail.css';

const SupplierDebtDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalData, setModalData] = useState<{ type: 'items'; record: any } | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'preview' | 'preview-excel' | null>(null);
  const [preview, setPreview] = useState<{ type: 'pdf'; url: string } | { type: 'excel'; html: string } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [invoiceDateRange, setInvoiceDateRange] = useState<[any, any] | null>([dayjs().startOf('month'), dayjs().endOf('month')]);
  const canRecordPayment = usePermission('payable.record_payment');
  const canExport = usePermission('payable.export');

  const { data, isLoading } = useSupplierDebtDetail(supplierId);
  const detail = data?.data as any;

  const filteredPayables = useMemo(() => {
    if (!detail) return [];
    let list = [...(detail.payables as any[])];
    list.sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p: any) => p.invoice_number?.toLowerCase().includes(q) || p.purchase_order?.order_code?.toLowerCase().includes(q));
    }
    if (onlyUnpaid) list = list.filter((p: any) => Number(p.remaining) > 0);
    if (invoiceDateRange?.[0] && invoiceDateRange?.[1]) {
      const from = invoiceDateRange[0].startOf('day');
      const to = invoiceDateRange[1].endOf('day');
      list = list.filter((p: any) => {
        const d = dayjs(p.invoice_date);
        return (d.isAfter(from) && d.isBefore(to)) || d.isSame(from, 'day') || d.isSame(to, 'day');
      });
    }
    return list;
  }, [detail, search, onlyUnpaid, invoiceDateRange]);

  const totals = useMemo(() => filteredPayables.reduce((acc, p: any) => ({
    original: acc.original + Number(p.original_amount),
    paid: acc.paid + (Number(p.original_amount) - Number(p.remaining)),
    remaining: acc.remaining + Number(p.remaining),
  }), { original: 0, paid: 0, remaining: 0 }), [filteredPayables]);

  const openingBalance = useMemo(() => {
    if (!detail || !invoiceDateRange?.[0]) return 0;
    const from = invoiceDateRange[0].startOf('day');
    return (detail.payables as any[]).filter((p: any) => dayjs(p.invoice_date).isBefore(from, 'day'))
      .reduce((s, p: any) => s + Number(p.remaining), 0);
  }, [detail, invoiceDateRange]);

  const chartData = useMemo(() => {
    if (!detail) return [];
    const monthMap = new Map<string, { debt: number; paid: number }>();
    for (const r of detail.payables as any[]) {
      const m = dayjs(r.invoice_date).format('YYYY-MM');
      const e = monthMap.get(m) || { debt: 0, paid: 0 };
      e.debt += Number(r.original_amount); monthMap.set(m, e);
      for (const p of (r.payments || [])) {
        const pm = dayjs(p.payment_date).format('YYYY-MM');
        const pe = monthMap.get(pm) || { debt: 0, paid: 0 }; pe.paid += Number(p.amount); monthMap.set(pm, pe);
      }
    }
    let cumDebt = 0, cumPaid = 0;
    return Array.from(monthMap.keys()).sort().map((key) => {
      const v = monthMap.get(key)!; cumDebt += v.debt; cumPaid += v.paid;
      return { date: dayjs(key).format('MM/YYYY'), remaining: Math.max(0, cumDebt - cumPaid) };
    });
  }, [detail]);

  const handleExport = async (action: 'excel' | 'pdf' | 'preview' | 'preview-excel', range: { from_date?: string; to_date?: string }) => {
    if (!supplierId) return;
    setExporting(action);
    try {
      if (action === 'preview') {
        const res = await payableApi.exportPdf(supplierId, range);
        const blob = new Blob([res.data], { type: 'application/pdf' });
        setPreview({ type: 'pdf', url: URL.createObjectURL(blob) }); setShowExportModal(false);
      } else if (action === 'preview-excel') {
        const res = await payableApi.exportExcel(supplierId, range);
        const arrayBuf = await (res.data as Blob).arrayBuffer();
        const XLSX = await import('xlsx');
        const wb = XLSX.read(arrayBuf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const html = sheet ? XLSX.utils.sheet_to_html(sheet) : `<p>${t('debt.exportEmptySheet')}</p>`;
        setPreview({ type: 'excel', html }); setShowExportModal(false);
      } else {
        const res = action === 'pdf' ? await payableApi.exportPdf(supplierId, range) : await payableApi.exportExcel(supplierId, range);
        const mime = action === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = new Blob([res.data], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `cong-no-ncc-${detail?.supplier?.company_name || supplierId}.${action === 'pdf' ? 'pdf' : 'xlsx'}`;
        a.click(); URL.revokeObjectURL(url); setShowExportModal(false);
      }
    } catch { toast.error(t('common.error')); } finally { setExporting(null); }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!detail) return <Empty description={t('supplier.notFound')} style={{ marginTop: 80 }} />;

  const { supplier, summary } = detail;
  const paidPercent = summary.total_original > 0 ? Math.min(100, Math.round((summary.total_paid / summary.total_original) * 100)) : 0;
  const initials = getInitials(supplier.company_name || 'NCC');
  const totalShort = formatVNDShort(summary.total_original);
  const paidShort = formatVNDShort(summary.total_paid);
  const remainShort = formatVNDShort(summary.total_remaining);

  const invoiceColumns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, idx: number) => (page - 1) * pageSize + idx + 1 },
    { title: t('debt.invoiceNumber'), dataIndex: 'invoice_number', key: 'invoice_number', width: 130 },
    { title: t('order.orderCode'), key: 'order_code', width: 160, render: (_: any, rec: any) => rec.purchase_order ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${rec.purchase_order.id}`)}>{rec.purchase_order.order_code}</Button> : '-' },
    { title: t('debt.invoiceDate'), dataIndex: 'invoice_date', key: 'invoice_date', width: 110, render: (v: string) => formatDate(v) },
    { title: t('debt.contractValueShort'), dataIndex: 'original_amount', key: 'original_amount', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: '', key: 'actions', width: 50, align: 'center' as const, render: (_: any, rec: any) => rec.purchase_order?.items?.length > 0 ? <Tooltip title={t('order.productDetails')}><Button type="text" size="small" icon={<UnorderedListOutlined />} onClick={() => setModalData({ type: 'items', record: rec })} /></Tooltip> : null },
  ];

  return (
    <div className="pd-root">
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <a onClick={() => navigate('/debts')}>{t('debt.payables')}</a>
          <span className="sep">/</span>
          <span className="current">{supplier.company_name}</span>
        </div>
        <div className="pd-actions">
          {canExport && <button className="pd-btn" onClick={() => setShowExportModal(true)}><DownloadOutlined /> {t('debt.exportReport')}</button>}
          {canRecordPayment && summary.total_remaining > 0 && <button className="pd-btn pd-btn-primary" onClick={() => setShowPayment(true)}><DollarOutlined /> {t('common.recordPayment')}</button>}
        </div>
      </div>

      <div className="pd-main">
        <section className="pd-hero pd-hero-cust">
          <div className="pd-cust-card">
            <div className="pd-cust-cover"><div className="pd-cust-cover-label">{t('debt.payables')}</div></div>
            <div className="pd-cust-avatar-wrap"><div className="pd-cust-avatar" style={{ background: 'linear-gradient(135deg, #F3E8FF 0%, #C4B5FD 100%)' }}>{initials}</div></div>
            <div className="pd-cust-body">
              <h2 className="pd-cust-name">{supplier.company_name}</h2>
              <div className="pd-cust-id">{supplier.id?.slice(0, 8).toUpperCase()}</div>
              <div className="pd-cust-badges">
                {summary.total_remaining > 0
                  ? <span className="pd-badge pd-badge-red">{t('debt.statusUnpaid')}</span>
                  : <span className="pd-badge pd-badge-success">{t('debt.statusPaid')}</span>}
              </div>
              <ul className="pd-cust-meta-list">
                {supplier.contact_name && <li><span className="lbl">{t('customer.contactName')}</span><span className="val">{supplier.contact_name}</span></li>}
                {supplier.phone && <li><span className="lbl">{t('customer.phone')}</span><span className="val mono">{supplier.phone}</span></li>}
                {supplier.email && <li><span className="lbl">Email</span><span className="val" style={{ fontSize: 12 }}>{supplier.email}</span></li>}
              </ul>
              <div className="pd-cust-actions">
                <button className="pd-btn" onClick={() => navigate(`/suppliers/${supplier.id}`)}>{t('common.viewDetail')}</button>
              </div>
            </div>
          </div>

          <div className="pd-info">
            <div className="pd-meta-row">
              <span className="pd-badge pd-badge-info">{t('debt.payableLedger')}</span>
            </div>
            <div className="pd-title-block">
              <h1 className="pd-title">{t('debt.totalPayable')}</h1>
              <p className="pd-subtitle">{t('debt.payableLedgerSubtitle')}</p>
            </div>

            <div className="pd-metrics">
              <div className="pd-metric">
                <div className="pd-metric-label">{t('debt.totalDebt')}</div>
                <div className="pd-metric-value">{totalShort.value}<span className="pd-metric-unit"> {totalShort.unit}</span></div>
                <div className="pd-metric-trend">{detail.payables?.length || 0} {t('debt.invoices')}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">{t('debt.totalPaid')}</div>
                <div className="pd-metric-value success">{paidShort.value}<span className="pd-metric-unit"> {paidShort.unit}</span></div>
                <div className="pd-metric-trend trend-up">{paidPercent}%</div>
              </div>
              <div className={`pd-metric${summary.total_remaining > 0 ? ' alert' : ''}`}>
                <div className="pd-metric-label">{t('debt.remaining')}</div>
                <div className={`pd-metric-value${summary.total_remaining > 0 ? ' danger' : ' success'}`}>{remainShort.value}<span className="pd-metric-unit"> {remainShort.unit}</span></div>
                <div className="pd-metric-trend">{summary.total_remaining > 0 ? t('debt.outstanding') : t('debt.statusPaid')}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">{t('debt.paymentProgress')}</div>
                <div className="pd-metric-value">{paidPercent}<span className="pd-metric-unit"> %</span></div>
                <div className="pd-metric-trend">{summary.total_original > 0 && (
                  <Progress percent={paidPercent} size="small" showInfo={false} strokeColor={paidPercent === 100 ? '#15803D' : '#1F3A8A'} />
                )}</div>
              </div>
            </div>
          </div>
        </section>

        {chartData.length > 1 && (
          <div className="pd-tabs-wrap" style={{ padding: 24, marginBottom: 16 }}>
            <div className="pd-section-header"><h2 className="pd-section-title"><span className="num">·</span> {t('debt.debtTracking')}</h2></div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs><linearGradient id="sdRem" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#B45309" stopOpacity={0.2} /><stop offset="95%" stopColor="#B45309" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEAE0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8A8A85' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A85' }} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
                <RTooltip formatter={(value) => formatVND(Number(value))} />
                <Area type="monotone" dataKey="remaining" name={t('debt.remaining')} stroke="#B45309" fill="url(#sdRem)" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="pd-tabs-wrap" style={{ padding: 24 }}>
          <div className="pd-section-header"><h2 className="pd-section-title"><span className="num">·</span> {t('debt.invoiceList')}</h2></div>
          <div className="pd-filter-bar">
            <Input className="pd-input" prefix={<SearchOutlined />} placeholder={t('debt.searchInvoice')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <DatePicker.RangePicker value={invoiceDateRange as any} format="DD/MM/YYYY" onChange={(d) => { setInvoiceDateRange(d as any); setPage(1); }} placeholder={[t('common.fromDate'), t('common.toDate')]} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--pd-text-2)' }}>
              <Switch checked={onlyUnpaid} onChange={(v) => { setOnlyUnpaid(v); setPage(1); }} size="small" /> {t('debt.onlyUnpaid')}
            </span>
          </div>

          {openingBalance > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--pd-amber-soft)', border: '1px solid #FCD34D', borderRadius: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong style={{ fontSize: 13 }}>{t('debt.openingBalance')}</strong>
                <div style={{ fontSize: 11, color: 'var(--pd-text-3)' }}>{t('debt.openingBalanceHint')}</div>
              </div>
              <strong style={{ fontSize: 15, color: 'var(--pd-amber)', fontFamily: 'Geist Mono, monospace' }}>{formatVND(openingBalance)}</strong>
            </div>
          )}

          <Table dataSource={filteredPayables} columns={invoiceColumns} rowKey="id" size="small" scroll={{ x: 'max-content' }}
            pagination={{ current: page, pageSize, total: filteredPayables.length, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'], showTotal: (total) => t('debt.totalInvoices', { count: total }), onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
            summary={() => filteredPayables.length === 0 ? null : (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: 'var(--pd-bg-warm)' }}>
                  <Table.Summary.Cell index={0} colSpan={4} align="right"><strong>{t('debt.grandTotalRow')} — {t('debt.contractValueShort')}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><strong>{formatVND(totals.original)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
                <Table.Summary.Row style={{ background: 'var(--pd-bg-warm)' }}>
                  <Table.Summary.Cell index={0} colSpan={4} align="right">{t('debt.paidShort')}</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><strong style={{ color: 'var(--pd-green)' }}>{formatVND(totals.paid)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
                <Table.Summary.Row style={{ background: 'var(--pd-bg-warm)' }}>
                  <Table.Summary.Cell index={0} colSpan={4} align="right">{t('debt.remaining')}</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><strong style={{ color: totals.remaining > 0 ? 'var(--pd-amber)' : 'var(--pd-green)' }}>{formatVND(totals.remaining)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
                <Table.Summary.Row style={{ background: '#FEF3C7', borderTop: '2px solid #FCD34D' }}>
                  <Table.Summary.Cell index={0} colSpan={4} align="right"><strong style={{ fontSize: 14 }}>{t('debt.closingBalance')}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><strong style={{ fontSize: 14, color: (openingBalance + totals.remaining) > 0 ? 'var(--pd-amber)' : 'var(--pd-green)' }}>{formatVND(openingBalance + totals.remaining)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
              </Table.Summary>
            )} />
        </div>
      </div>

      <Modal open={modalData?.type === 'items'} title={`${t('order.productDetails')} - ${modalData?.record?.invoice_number || ''}`} footer={null} width={Math.min(window.innerWidth * 0.95, 700)} onCancel={() => setModalData(null)}>
        {modalData?.type === 'items' && (() => {
          const rec = modalData.record; const items = rec.purchase_order?.items || [];
          return (<>
            {rec.purchase_order?.expected_delivery && <div style={{ fontSize: 12, marginBottom: 4, color: '#666' }}>{t('order.expectedDelivery')}: {formatDate(rec.purchase_order.expected_delivery)}</div>}
            {rec.purchase_order?.notes && <div style={{ fontSize: 12, marginBottom: 8, color: '#666' }}>{t('common.notes')}: {rec.purchase_order.notes}</div>}
            <Table size="small" dataSource={items} rowKey={(_, idx) => String(idx)} pagination={false} scroll={{ x: 'max-content' }} columns={[
              { title: 'STT', key: 'stt', width: 45, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
              { title: t('product.name'), key: 'name', ellipsis: true, render: (_: any, item: any) => (<div><div>{item.product?.name}</div><div style={{ fontSize: 11, color: '#999' }}>{item.product?.sku}{item.product?.material && ` · ${item.product.material}`}{item.product?.capacity_ml != null && ` · ${item.product.capacity_ml}ml`}</div></div>) },
              { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'unit_price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
              { title: 'SL', dataIndex: 'quantity', key: 'quantity', width: 60, align: 'right' as const },
              { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'line_total', width: 130, align: 'right' as const, render: (v: number) => <strong>{formatVND(v)}</strong> },
            ]} />
          </>);
        })()}
      </Modal>

      {showPayment && <PaymentModal open type="payable" debtId={supplierId!} maxAmount={summary.total_remaining} onClose={() => setShowPayment(false)} />}
      <ExportLedgerModal open={showExportModal} loading={exporting} onClose={() => setShowExportModal(false)} onConfirm={handleExport} />

      <Modal open={!!preview} title={preview?.type === 'excel' ? t('debt.exportPreviewExcel') : t('debt.exportPreviewPdf')} width="90vw" footer={null}
        onCancel={() => { if (preview?.type === 'pdf') URL.revokeObjectURL(preview.url); setPreview(null); }}
        styles={{ body: { height: '80vh', padding: 0, overflow: 'hidden' } }}>
        {preview?.type === 'pdf' && <iframe title="pdf-preview" src={preview.url} style={{ width: '100%', height: '100%', border: 0 }} />}
        {preview?.type === 'excel' && <div style={{ padding: 16, height: '100%', overflow: 'auto', background: '#f5f5f5', fontFamily: "'Times New Roman', serif" }} dangerouslySetInnerHTML={{ __html: `<style>table{border-collapse:collapse;background:#fff;width:100%}td,th{border:1px solid #bfbfbf;padding:6px 10px;font-size:12px}tr:first-child td{font-weight:bold;background:#fafafa}</style>${preview.html}` }} />}
      </Modal>
    </div>
  );
};

export default SupplierDebtDetailPage;
