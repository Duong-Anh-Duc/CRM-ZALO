import React from 'react';
import { Card, Table, Tag, Spin, Empty, Space, Row, Col, Typography, Avatar, Tabs, Button, Image, Popconfirm } from 'antd';
import { StarFilled, ShoppingOutlined, DollarOutlined, ShopOutlined, InfoCircleOutlined, ExperimentOutlined, ColumnHeightOutlined, BgColorsOutlined, BorderOutlined, ToolOutlined, InboxOutlined, NumberOutlined, DashboardOutlined, AppstoreOutlined, TagsOutlined, SafetyCertificateOutlined, FilePdfOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useProduct } from '../hooks';
import { SupplierPrice } from '@/types';
import { formatVND, materialLabels, formatNumber } from '@/utils/format';
import apiClient from '@/lib/api-client';
import { toast } from 'react-toastify';
import SupplierPriceFormModal from '../components/SupplierPriceFormModal';

const { Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 };

const PAGE_SIZE = 10;

const ProductDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: productData, isLoading } = useProduct(id);
  const product = productData?.data as any;
  const [salesPage, setSalesPage] = React.useState(1);
  const [purchasePage, setPurchasePage] = React.useState(1);
  const [supplierPage, setSupplierPage] = React.useState(1);
  const [spModal, setSpModal] = React.useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const qc = useQueryClient();

  const handleDeleteSupplierPrice = async (spId: string) => {
    try {
      await apiClient.delete(`/supplier-prices/${spId}`);
      toast.success(t('common.deleted'));
      qc.invalidateQueries({ queryKey: ['product', id] });
    } catch (err: any) { toast.error(err?.response?.data?.message || t('common.error')); }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!product) return <Empty description={t('product.notFound')} style={{ marginTop: 80 }} />;

  const colorLabel = (key: string) => t(`colorLabels.${key}`);
  const shapeLabel = (key: string) => t(`shapeLabels.${key}`);
  const neckLabel = (key: string) => t(`neckLabels.${key}`);
  const unitLabel = (key: string) => t(`unitLabels.${key}`);
  const industryLabel = (key: string) => t(`industryLabels.${key}`);
  const safetyLabel = (key: string) => t(`safetyLabels.${key}`);

  const Field = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
    <div style={fieldStyle}>
      <Text style={labelStyle}>{label}</Text>
      <Text strong>{value || value === 0 ? value : '—'}</Text>
    </div>
  );

  const salesItems = product.sales_order_items || [];
  const purchaseItems = product.purchase_order_items || [];

  const generalContent = (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12}><Field label={t('product.name')} value={product.name} /></Col>
        <Col xs={24} sm={12}><Field label="SKU" value={product.sku} /></Col>
        <Col xs={24} sm={12}><Field label={t('product.category')} value={product.category?.name} /></Col>
        <Col xs={24} sm={12}><Field label={t('common.status')} value={product.is_active ? t('common.activeStatus') : t('common.inactiveStatus')} /></Col>
        <Col xs={24}><Field label={t('common.description')} value={product.description} /></Col>
      </Row>

      <div style={sectionTitleStyle}><DollarOutlined style={{ color: '#1890ff' }} /> {t('product.pricing')}</div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Text style={labelStyle}><DollarOutlined style={{ marginRight: 4, color: '#1890ff' }} />{t('product.retailPrice')}</Text>
            <Text strong style={{ fontSize: 20, color: '#1890ff' }}>{product.retail_price ? formatVND(product.retail_price) : '—'}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Text style={labelStyle}><DashboardOutlined style={{ marginRight: 4, color: '#fa8c16' }} />{t('product.priceTiers')}</Text>
            <Text strong style={{ fontSize: 20, color: '#fa8c16' }}>{product.price_tiers?.length || 0} {t('product.tiers')}</Text>
          </Card>
        </Col>
      </Row>
      {product.price_tiers && product.price_tiers.length > 0 && (
        <Table dataSource={product.price_tiers} rowKey="id" pagination={false} size="small" style={{ marginBottom: 20 }}
          columns={[
            { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
            { title: t('product.minQty'), dataIndex: 'min_qty', key: 'min', width: 120, align: 'right' as const, render: (v: number) => formatNumber(v) },
            { title: t('product.unitPrice'), dataIndex: 'price', key: 'price', width: 150, align: 'right' as const, render: (v: number) => formatVND(v) },
          ]}
        />
      )}

      <div style={sectionTitleStyle}><ExperimentOutlined style={{ color: '#13c2c2' }} /> {t('product.technicalSpecs')}</div>
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}><Field label={<><ExperimentOutlined style={{ marginRight: 4 }} />{t('product.material')}</>} value={product.material ? materialLabels[product.material] : null} /></Col>
        <Col xs={24} sm={8}><Field label={<><DashboardOutlined style={{ marginRight: 4 }} />{t('product.capacity')}</>} value={product.capacity_ml ? `${formatNumber(product.capacity_ml)} ml` : null} /></Col>
        <Col xs={24} sm={8}><Field label={<><ColumnHeightOutlined style={{ marginRight: 4 }} />{t('product.heightMm')}</>} value={product.height_mm ? `${product.height_mm} mm` : null} /></Col>
        <Col xs={24} sm={8}><Field label={t('product.bodyDiaMm')} value={product.body_dia_mm ? `${product.body_dia_mm} mm` : null} /></Col>
        <Col xs={24} sm={8}><Field label={t('product.neckDiaMm')} value={product.neck_dia_mm ? `${product.neck_dia_mm} mm` : null} /></Col>
        <Col xs={24} sm={8}><Field label={<><DashboardOutlined style={{ marginRight: 4 }} />{t('product.weightG')}</>} value={product.weight_g ? `${product.weight_g} g` : null} /></Col>
        <Col xs={24} sm={8}><Field label={<><BgColorsOutlined style={{ marginRight: 4 }} />{t('product.color')}</>} value={product.color ? colorLabel(product.color) + (product.custom_color ? ` (${product.custom_color})` : '') : null} /></Col>
        <Col xs={24} sm={8}><Field label={<><BorderOutlined style={{ marginRight: 4 }} />{t('product.shape')}</>} value={product.shape ? shapeLabel(product.shape) : null} /></Col>
        <Col xs={24} sm={8}><Field label={<><ToolOutlined style={{ marginRight: 4 }} />{t('product.neckType')}</>} value={product.neck_type ? neckLabel(product.neck_type) + (product.neck_spec ? ` - ${product.neck_spec}` : '') : null} /></Col>
      </Row>

      <div style={sectionTitleStyle}><InboxOutlined style={{ color: '#eb2f96' }} /> {t('product.packaging')}</div>
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}><Field label={<><InboxOutlined style={{ marginRight: 4 }} />{t('product.unitOfSale')}</>} value={unitLabel(product.unit_of_sale)} /></Col>
        <Col xs={24} sm={8}><Field label={<><NumberOutlined style={{ marginRight: 4 }} />{t('product.moq')}</>} value={product.moq ? formatNumber(product.moq) : null} /></Col>
        <Col xs={24} sm={8}><Field label={t('product.pcsPerCarton')} value={product.pcs_per_carton ? formatNumber(product.pcs_per_carton) : null} /></Col>
        <Col xs={24} sm={8}><Field label={t('product.cartonWeight')} value={product.carton_weight ? `${product.carton_weight} kg` : null} /></Col>
        <Col xs={24} sm={8}><Field label={t('product.cartonLength')} value={product.carton_length ? `${product.carton_length} mm` : null} /></Col>
        <Col xs={24} sm={8}><Field label={t('product.cartonWidth')} value={product.carton_width ? `${product.carton_width} mm` : null} /></Col>
        <Col xs={24} sm={8}><Field label={t('product.cartonHeight')} value={product.carton_height ? `${product.carton_height} mm` : null} /></Col>
      </Row>

      <div style={sectionTitleStyle}><AppstoreOutlined style={{ color: '#faad14' }} /> {t('product.application')}</div>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12}>
          <div style={fieldStyle}>
            <Text style={labelStyle}><TagsOutlined style={{ marginRight: 4 }} />{t('product.industries')}</Text>
            {product.industries?.length > 0 ? (
              <Space size={4} wrap>
                {product.industries.map((ind: string) => (
                  <Tag key={ind} color="blue" style={{ borderRadius: 6, marginTop: 4 }}>{industryLabel(ind)}</Tag>
                ))}
              </Space>
            ) : <Text strong>—</Text>}
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div style={fieldStyle}>
            <Text style={labelStyle}><SafetyCertificateOutlined style={{ marginRight: 4 }} />{t('product.safetyStandards')}</Text>
            {product.safety_standards?.length > 0 ? (
              <Space size={4} wrap>
                {product.safety_standards.map((std: string) => (
                  <Tag key={std} color="green" style={{ borderRadius: 6, marginTop: 4 }}>{safetyLabel(std)}</Tag>
                ))}
              </Space>
            ) : <Text strong>—</Text>}
          </div>
        </Col>
        {product.catalog_pdf_url && (
          <Col xs={24}>
            <div style={fieldStyle}>
              <Text style={labelStyle}><FilePdfOutlined style={{ marginRight: 4 }} />Catalog PDF</Text>
              <Button type="link" icon={<FilePdfOutlined />} style={{ padding: 0 }} onClick={() => window.open(product.catalog_pdf_url, '_blank')}>
                {t('common.viewDetail')}
              </Button>
            </div>
          </Col>
        )}
      </Row>
    </>
  );

  const tabItems = [
    {
      key: 'general',
      label: <><InfoCircleOutlined /> {t('product.generalInfo')}</>,
      children: generalContent,
    },
    {
      key: 'suppliers',
      label: <><ShopOutlined /> {t('product.supplierPrices')} ({product.supplier_prices?.length || 0})</>,
      children: (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} size="small" style={{ borderRadius: 8 }} onClick={() => setSpModal({ open: true, record: null })}>
              {t('product.addSupplierPrice')}
            </Button>
          </div>
          <Table<SupplierPrice>
            dataSource={product.supplier_prices} rowKey="id"
            size="small" scroll={{ x: 760 }}
            pagination={(product.supplier_prices?.length || 0) > PAGE_SIZE ? { pageSize: PAGE_SIZE, current: supplierPage, onChange: setSupplierPage } : false}
            columns={[
              { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => (supplierPage - 1) * PAGE_SIZE + i + 1 },
              { title: t('product.supplier'), key: 'supplier', ellipsis: true, render: (_: any, r: any) => r.supplier ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/suppliers/${r.supplier.id}`)}>{r.supplier.company_name}</Button> : '-' },
              { title: t('product.purchasePrice'), dataIndex: 'purchase_price', key: 'pp', width: 130, align: 'right' as const, render: (v: number) => formatVND(v) },
              { title: 'MOQ', dataIndex: 'moq', key: 'moq', width: 90, align: 'right' as const, render: (v: number) => v ? formatNumber(v) : '-' },
              { title: t('supplier.leadTime'), dataIndex: 'lead_time_days', key: 'lead', width: 130, render: (v: number) => v ? `${v} ${t('product.days')}` : '-' },
              { title: t('product.preferred'), dataIndex: 'is_preferred', key: 'pref', width: 70, align: 'center' as const, render: (v: boolean) => v ? <StarFilled style={{ color: '#faad14' }} /> : null },
              { title: t('common.actions'), key: 'actions', width: 100, fixed: 'right' as const, align: 'center' as const, render: (_: any, r: any) => (
                <Space size={0}>
                  <Button type="text" size="small" icon={<EditOutlined />} style={{ color: '#faad14' }} onClick={() => setSpModal({ open: true, record: r })} />
                  <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => handleDeleteSupplierPrice(r.id)} okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )},
            ]}
            locale={{ emptyText: <Empty description={t('product.noSupplierPrices')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />
        </>
      ),
    },
    {
      key: 'sales',
      label: <><DollarOutlined /> {t('product.salesHistory')} ({salesItems.length})</>,
      children: (
        <Table size="small" dataSource={salesItems} rowKey="id" scroll={{ x: 'max-content' }}
          pagination={salesItems.length > PAGE_SIZE ? { pageSize: PAGE_SIZE, current: salesPage, onChange: setSalesPage } : false}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
          columns={[
            { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (salesPage - 1) * PAGE_SIZE + i + 1 },
            { title: t('order.orderCode'), key: 'code', width: 170, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/sales-orders/${r.sales_order?.id}`)}>{r.sales_order?.order_code}</Button> },
            { title: t('customer.name'), key: 'cust', ellipsis: true, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/customers/${r.sales_order?.customer?.id}`)}>{r.sales_order?.customer?.company_name || r.sales_order?.customer?.contact_name}</Button> },
            { title: t('order.orderDate'), key: 'date', width: 110, render: (_: any, r: any) => r.sales_order?.order_date ? new Date(r.sales_order.order_date).toLocaleDateString('vi') : '-' },
            { title: 'SL', dataIndex: 'quantity', key: 'qty', width: 60, align: 'right' as const },
            { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
            { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{formatVND(v)}</Text> },
          ]}
        />
      ),
    },
    {
      key: 'purchase',
      label: <><ShopOutlined /> {t('product.purchaseHistory')} ({purchaseItems.length})</>,
      children: (
        <Table size="small" dataSource={purchaseItems} rowKey="id" scroll={{ x: 'max-content' }}
          pagination={purchaseItems.length > PAGE_SIZE ? { pageSize: PAGE_SIZE, current: purchasePage, onChange: setPurchasePage } : false}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
          columns={[
            { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (purchasePage - 1) * PAGE_SIZE + i + 1 },
            { title: t('order.orderCode'), key: 'code', width: 170, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${r.purchase_order?.id}`)}>{r.purchase_order?.order_code}</Button> },
            { title: t('supplier.name'), key: 'supp', ellipsis: true, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/suppliers/${r.purchase_order?.supplier?.id}`)}>{r.purchase_order?.supplier?.company_name}</Button> },
            { title: t('order.orderDate'), key: 'date', width: 110, render: (_: any, r: any) => r.purchase_order?.order_date ? new Date(r.purchase_order.order_date).toLocaleDateString('vi') : '-' },
            { title: 'SL', dataIndex: 'quantity', key: 'qty', width: 60, align: 'right' as const },
            { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
            { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{formatVND(v)}</Text> },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <Card style={cardStyle}>
        <Space size={16} style={{ marginBottom: 20 }} wrap>
          {product.images?.[0]?.url ? (
            <Avatar size={56} shape="square" src={product.images[0].url} style={{ borderRadius: 12 }} />
          ) : (
            <Avatar size={56} style={{ background: '#1677ff', fontSize: 18 }} icon={<ShoppingOutlined />} />
          )}
          <div>
            <Text strong style={{ fontSize: 20, display: 'block' }}>{product.name}</Text>
            <Space size={8}>
              <Text type="secondary">SKU: {product.sku} · {product.category?.name || '-'}</Text>
              <Tag style={{ borderRadius: 12, fontWeight: 500, color: product.is_active ? '#52c41a' : '#999', background: product.is_active ? '#f6ffed' : '#f5f5f5', border: `1px solid ${product.is_active ? '#b7eb8f' : '#d9d9d9'}` }}>
                {product.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
              </Tag>
            </Space>
          </div>
        </Space>

        {product.images && product.images.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Image.PreviewGroup>
              <Space size={12} wrap>
                {product.images.map((img: any) => (
                  <Image key={img.id} src={img.url} width={120} height={120}
                    style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0' }} />
                ))}
              </Space>
            </Image.PreviewGroup>
          </div>
        )}

        <Tabs items={tabItems} />
      </Card>

      <SupplierPriceFormModal open={spModal.open} productId={id!} record={spModal.record}
        onClose={() => setSpModal({ open: false, record: null })}
        onSaved={() => qc.invalidateQueries({ queryKey: ['product', id] })} />
    </div>
  );
};

export default ProductDetailPage;
