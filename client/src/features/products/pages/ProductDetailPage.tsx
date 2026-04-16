import React, { useState } from 'react';
import { Card, Table, Tag, Spin, Empty, Space, Row, Col, Typography, Avatar, Tabs, Button, Image, Modal } from 'antd';
import { StarFilled, ShoppingOutlined, DollarOutlined, ShopOutlined, InfoCircleOutlined, ExperimentOutlined, ColumnHeightOutlined, BgColorsOutlined, BorderOutlined, ToolOutlined, InboxOutlined, NumberOutlined, DashboardOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct } from '../hooks';
import { SupplierPrice } from '@/types';
import { formatVND, materialLabels, formatNumber } from '@/utils/format';

const { Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const ProductDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [modal, setModal] = useState<'pricing' | 'suppliers' | null>(null);
  const { data: productData, isLoading } = useProduct(id);
  const product = productData?.data as any;

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!product) return <Empty description={t('product.notFound')} style={{ marginTop: 80 }} />;

  const colorLabel = (key: string) => t(`colorLabels.${key}`);
  const shapeLabel = (key: string) => t(`shapeLabels.${key}`);
  const neckLabel = (key: string) => t(`neckLabels.${key}`);
  const unitLabel = (key: string) => t(`unitLabels.${key}`);

  const Field = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
    <div style={fieldStyle}>
      <Text style={labelStyle}>{label}</Text>
      <Text strong>{value || '—'}</Text>
    </div>
  );

  const salesItems = product.sales_order_items || [];
  const purchaseItems = product.purchase_order_items || [];

  const tabItems = [
    {
      key: 'general',
      label: <><InfoCircleOutlined /> {t('product.generalInfo')}</>,
      children: (
        <div>
          {/* Header */}
          <Space size={16} style={{ marginBottom: 24 }}>
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

          {/* Product images */}
          {product.images && product.images.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Image.PreviewGroup>
                <Space size={12} wrap>
                  {product.images.map((img: any) => (
                    <Image key={img.id} src={img.url} width={120} height={120}
                      style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0' }}
                      fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjYwIiB5PSI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiNjY2MiIGZvbnQtc2l6ZT0iMTQiPk5vIGltYWdlPC90ZXh0Pjwvc3ZnPg==" />
                  ))}
                </Space>
              </Image.PreviewGroup>
            </div>
          )}

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={8}><Field label={<><ExperimentOutlined style={{ marginRight: 4 }} />{t('product.material')}</>} value={product.material ? materialLabels[product.material] : null} /></Col>
            <Col xs={24} sm={8}><Field label={<><DashboardOutlined style={{ marginRight: 4 }} />{t('product.capacity')}</>} value={product.capacity_ml ? `${formatNumber(product.capacity_ml)} ml` : null} /></Col>
            <Col xs={24} sm={8}><Field label={<><BgColorsOutlined style={{ marginRight: 4 }} />{t('product.color')}</>} value={product.color ? colorLabel(product.color) + (product.custom_color ? ` (${product.custom_color})` : '') : null} /></Col>
            <Col xs={24} sm={8}><Field label={<><BorderOutlined style={{ marginRight: 4 }} />{t('product.shape')}</>} value={product.shape ? shapeLabel(product.shape) : null} /></Col>
            <Col xs={24} sm={8}><Field label={<><ToolOutlined style={{ marginRight: 4 }} />{t('product.neckType')}</>} value={product.neck_type ? neckLabel(product.neck_type) + (product.neck_spec ? ` - ${product.neck_spec}` : '') : null} /></Col>
            <Col xs={24} sm={8}><Field label={<><InboxOutlined style={{ marginRight: 4 }} />{t('product.unitOfSale')}</>} value={unitLabel(product.unit_of_sale)} /></Col>
            <Col xs={24} sm={8}><Field label={<><NumberOutlined style={{ marginRight: 4 }} />MOQ</>} value={product.moq ? formatNumber(product.moq) : null} /></Col>
            <Col xs={24} sm={8}><Field label={<><DashboardOutlined style={{ marginRight: 4 }} />{t('product.weight')}</>} value={product.weight_g ? `${product.weight_g} g` : null} /></Col>
            <Col xs={24} sm={8}><Field label={<><ColumnHeightOutlined style={{ marginRight: 4 }} />{t('product.height')}</>} value={product.height_mm ? `${product.height_mm} mm` : null} /></Col>
            {product.description && (
              <Col xs={24}><Field label={t('product.description')} value={product.description} /></Col>
            )}
          </Row>

        </div>
      ),
    },
    {
      key: 'sales',
      label: <><DollarOutlined /> {t('product.salesHistory')} ({salesItems.length})</>,
      children: (
        <Table size="small" dataSource={salesItems} rowKey="id" scroll={{ x: 'max-content' }}
          pagination={salesItems.length > 10 ? { pageSize: 10 } : false}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
          columns={[
            { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
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
          pagination={purchaseItems.length > 10 ? { pageSize: 10 } : false}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
          columns={[
            { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
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
        <Tabs items={tabItems} />
      </Card>

      {/* Pricing + Suppliers */}
      <Card style={cardStyle}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Button block icon={<DollarOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setModal('pricing')}>
              {t('product.priceTable')}
            </Button>
          </Col>
          <Col xs={24} sm={12}>
            <Button block icon={<ShopOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setModal('suppliers')}>
              {t('product.supplierPrices')} ({product.supplier_prices?.length || 0})
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Pricing Modal */}
      <Modal open={modal === 'pricing'} onCancel={() => setModal(null)} footer={null}
        title={t('product.priceTable')} width={window.innerWidth < 640 ? '95vw' : 700}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '2px solid #91caff', height: '100%' }}>
              <Text style={labelStyle}><DollarOutlined style={{ marginRight: 4, color: '#1890ff' }} />{t('product.retailPrice')}</Text>
              <Text strong style={{ fontSize: 20, color: '#1890ff' }}>{product.retail_price ? formatVND(product.retail_price) : '—'}</Text>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '2px solid #b7eb8f', height: '100%' }}>
              <Text style={labelStyle}><ShoppingOutlined style={{ marginRight: 4, color: '#52c41a' }} />{t('product.wholesalePrice')}</Text>
              <Text strong style={{ fontSize: 20, color: '#52c41a' }}>{product.wholesale_price ? formatVND(product.wholesale_price) : '—'}</Text>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '2px solid #ffd591', height: '100%' }}>
              <Text style={labelStyle}><DashboardOutlined style={{ marginRight: 4, color: '#fa8c16' }} />{t('product.priceTiers')}</Text>
              <Text strong style={{ fontSize: 20, color: '#fa8c16' }}>{product.price_tiers?.length || 0} {t('product.tiers')}</Text>
            </Card>
          </Col>
        </Row>
        {product.price_tiers && product.price_tiers.length > 0 && (
          <Table dataSource={product.price_tiers} rowKey="id" pagination={false} size="small"
            columns={[
              { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
              { title: t('product.minQty'), dataIndex: 'min_qty', key: 'min', width: 120, align: 'right' as const, render: (v: number) => formatNumber(v) },
              { title: t('product.unitPrice'), dataIndex: 'price', key: 'price', width: 150, align: 'right' as const, render: (v: number) => formatVND(v) },
            ]}
          />
        )}
      </Modal>

      {/* Supplier Prices Modal */}
      <Modal open={modal === 'suppliers'} onCancel={() => setModal(null)} footer={null}
        title={t('product.supplierPrices') + ` (${product.supplier_prices?.length || 0})`}
        width={window.innerWidth < 640 ? '95vw' : 800}>
        <Table<SupplierPrice>
          dataSource={product.supplier_prices} rowKey="id"
          size="small" scroll={{ x: 660 }}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], showTotal: (total) => `${total} ${t('product.suppliersUnit')}` }}
          columns={[
            { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
            { title: t('product.supplier'), key: 'supplier', width: 250, ellipsis: true, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (_: any, r: any) => r.supplier ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => { setModal(null); navigate(`/suppliers/${r.supplier.id}`); }}>{r.supplier.company_name}</Button> : '-' },
            { title: t('product.purchasePrice'), dataIndex: 'purchase_price', key: 'pp', width: 120, align: 'right' as const, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: number) => formatVND(v) },
            { title: 'MOQ', dataIndex: 'moq', key: 'moq', width: 90, align: 'right' as const, render: (v: number) => v ? formatNumber(v) : '-' },
            { title: t('supplier.leadTime'), dataIndex: 'lead_time_days', key: 'lead', width: 130, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }), render: (v: number) => v ? `${v} ${t('product.days')}` : '-' },
            { title: t('product.preferred'), dataIndex: 'is_preferred', key: 'pref', width: 70, align: 'center' as const, render: (v: boolean) => v ? <StarFilled style={{ color: '#faad14' }} /> : null },
          ]}
          locale={{ emptyText: <Empty description={t('product.noSupplierPrices')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Modal>
    </div>
  );
};

export default ProductDetailPage;
