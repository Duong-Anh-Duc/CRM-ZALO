import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Select, DatePicker, Input, InputNumber, Button, Space, Row, Col, Typography, Drawer, Avatar, Tag, Empty, Divider, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreatePurchaseOrder, useSalesOrders } from '../../hooks';
import { useSuppliers } from '@/features/suppliers/hooks';
import { useProducts } from '@/features/products/hooks';
import { formatVND } from '@/utils/format';

const { Text, Title } = Typography;

interface OrderItem {
  key: number;
  product_id?: string;
  product?: any;
  quantity: number;
  unit_price: number;
}

const CreatePurchaseOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const createMutation = useCreatePurchaseOrder();

  const [items, setItems] = useState<OrderItem[]>([{ key: Date.now(), quantity: 1, unit_price: 0 }]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeItemKey, setActiveItemKey] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productMaterial, setProductMaterial] = useState('');

  const { data: suppliersData } = useSuppliers({ limit: 200 });
  const suppliers = (suppliersData?.data ?? []) as any[];

  const { data: salesOrdersData } = useSalesOrders({ limit: 200 });
  const salesOrders = (salesOrdersData?.data ?? []) as any[];
  const soOptions = salesOrders.map((so: any) => ({ label: `${so.order_code} — ${so.customer?.company_name || so.customer?.contact_name || ''}`, value: so.id }));

  const { data: productsData } = useProducts({
    limit: 50,
    search: productSearch || undefined,
    category_id: productCategory || undefined,
    material: productMaterial || undefined,
  });
  const products = (productsData?.data ?? []) as any[];

  const categories = [...new Map<string, any>(products.filter((p: any) => p.category?.id).map((p: any) => [p.category.id, p.category])).values()];

  const supplierOptions = suppliers.map((s: any) => ({
    label: `${s.company_name} ${s.phone ? '- ' + s.phone : ''}`,
    value: s.id,
  }));

  const openProductSearch = (itemKey: number) => {
    setActiveItemKey(itemKey);
    setProductSearch('');
    setProductCategory('');
    setProductMaterial('');
    setDrawerOpen(true);
  };

  const selectProduct = (product: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== activeItemKey) return item;
        return {
          ...item,
          product_id: product.id,
          product,
          unit_price: product.retail_price || 0,
        };
      })
    );
    setDrawerOpen(false);
    setActiveItemKey(null);
  };

  const updateItem = (key: number, field: string, value: any) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { key: Date.now(), quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (key: number) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const lineTotal = (item: OrderItem) => item.quantity * item.unit_price;

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const validItems = items.filter((item) => item.product_id);
      if (validItems.length === 0) { message.error(t('order.minOneItem')); return; }
      if (items.some(i => !i.product_id)) { message.error(t('order.invalidProduct')); return; }

      const payload = {
        supplier_id: values.supplier_id,
        sales_order_id: values.sales_order_id || undefined,
        expected_delivery: values.expected_delivery?.format('YYYY-MM-DD'),
        notes: values.notes,
        shipping_fee: values.shipping_fee || 0,
        other_fee: values.other_fee || 0,
        items: validItems.map((item) => ({
          product_id: item.product_id!,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };
      createMutation.mutate(payload, {
        onSuccess: () => navigate('/purchase-orders'),
      });
    } catch {
      // validation
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/purchase-orders')} />
        <Title level={4} style={{ margin: 0 }}>{t('order.createPurchaseOrder')}</Title>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Form form={form} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={10}>
              <Form.Item name="supplier_id" label={t('order.supplier')} rules={[{ required: true, message: t('validation.supplierRequired') }]}>
                <Select showSearch optionFilterProp="label" options={supplierOptions} placeholder={t('order.selectSupplier')} style={{ borderRadius: 8 }} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="sales_order_id" label={t('order.linkedSO')}>
                <Select showSearch optionFilterProp="label" options={soOptions} placeholder={t('order.selectLinkedSO')} allowClear style={{ borderRadius: 8 }} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="expected_delivery" label={t('order.expectedDelivery')}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} size="large" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="shipping_fee" label={t('order.shippingFee')}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="other_fee" label={t('order.otherFee')}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="notes" label={t('common.notes')}>
                <Input.TextArea rows={2} style={{ borderRadius: 8 }} placeholder={t('order.notesPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider>{t('order.productDetails')}</Divider>

        {/* Items */}
        <div>
          {items.map((item, index) => (
            <Card key={item.key} size="small" style={{ borderRadius: 12, marginBottom: 12, border: !item.product_id ? '1px dashed #ff4d4f' : '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600, fontSize: 12 }}>#{index + 1}</Tag>
                {items.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeItem(item.key)} />}
              </div>

              <div onClick={() => openProductSearch(item.key)} style={{
                border: '1px dashed #d9d9d9', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', marginBottom: 12,
                background: item.product ? '#f6ffed' : '#fafafa', display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.2s',
              }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1677ff'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d9d9d9'; }}>
                {item.product ? (
                  <>
                    {item.product.images?.[0]?.url ? <Avatar size={44} src={item.product.images[0].url} shape="square" style={{ borderRadius: 8, flexShrink: 0 }} /> : <Avatar size={44} shape="square" style={{ borderRadius: 8, background: '#e6f4ff', color: '#1677ff', flexShrink: 0 }}>{item.product.sku?.slice(0, 3)}</Avatar>}
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 14, display: 'block' }}>{item.product.name}</Text>
                      <Space size={6}>
                        <Tag style={{ borderRadius: 4, fontSize: 11 }}>{item.product.sku}</Tag>
                        {item.product.material && <Tag color="geekblue" style={{ borderRadius: 4, fontSize: 10 }}>{item.product.material}</Tag>}
                        {item.product.capacity_ml && <Text type="secondary" style={{ fontSize: 11 }}>{item.product.capacity_ml}ml</Text>}
                      </Space>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: 4 }}>
                    <SearchOutlined style={{ fontSize: 16, color: '#1677ff' }} />
                    <Text type="secondary">{t('order.searchProduct')}</Text>
                  </div>
                )}
              </div>

              <Row gutter={[10, 10]}>
                <Col xs={12} sm={8}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('order.qty')}</div>
                  <InputNumber min={1} value={item.quantity} onChange={(v) => updateItem(item.key, 'quantity', v || 1)} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
                <Col xs={12} sm={8}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('order.unitPrice')}</div>
                  <InputNumber min={0} value={item.unit_price} onChange={(v) => updateItem(item.key, 'unit_price', v || 0)} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any} style={{ width: '100%', borderRadius: 8 }} addonAfter="₫" />
                </Col>
                <Col xs={24}>
                  <div style={{ background: '#f6ffed', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>{t('order.lineTotal')}</Text>
                    <Text strong style={{ fontSize: 16, color: '#52c41a' }}>{formatVND(lineTotal(item))}</Text>
                  </div>
                </Col>
              </Row>

              {!item.product_id && <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>{t('validation.productRequired')}</Text>}
            </Card>
          ))}
        </div>

        <Button type="dashed" onClick={addItem} icon={<PlusOutlined />} block style={{ borderRadius: 8, marginTop: 8 }}>
          {t('product.addProduct')}
        </Button>

        {/* Summary */}
        <Row justify="end" style={{ marginTop: 20 }}>
          <Col>
            <Space direction="vertical" align="end" size={4}>
              <Text>{t('order.subtotalLabel')}: <Text strong style={{ fontSize: 18 }}>{formatVND(subtotal)}</Text></Text>
              <Space size={12} style={{ marginTop: 12 }}>
                <Button size="large" onClick={() => navigate('/purchase-orders')} style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
                <Button type="primary" size="large" loading={createMutation.isPending} onClick={handleSubmit} style={{ borderRadius: 8 }} icon={<ShoppingCartOutlined />}>
                  {t('order.createPurchaseOrder')}
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Product Search Drawer */}
      <Drawer
        title={t('order.searchProduct')}
        placement="right"
        width={window.innerWidth < 640 ? '100%' : 600}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('order.searchProductPlaceholder')}
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          allowClear size="large" style={{ borderRadius: 8, marginBottom: 12 }} autoFocus
        />

        <Space wrap style={{ marginBottom: 16, width: '100%' }}>
          <Select value={productCategory} onChange={setProductCategory} placeholder={t('product.category')} allowClear
            style={{ minWidth: 160, borderRadius: 8 }}
            options={[{ label: t('common.all'), value: '' }, ...categories.map((c: any) => ({ label: c?.name, value: c?.id }))]}
          />
          <Select value={productMaterial} onChange={setProductMaterial} placeholder={t('product.material')} allowClear
            style={{ minWidth: 120, borderRadius: 8 }}
            options={[
              { label: t('common.all'), value: '' },
              { label: 'PET', value: 'PET' }, { label: 'HDPE', value: 'HDPE' },
              { label: 'PP', value: 'PP' }, { label: 'PVC', value: 'PVC' },
            ]}
          />
          <Text type="secondary">{products.length} {t('product.results')}</Text>
        </Space>

        {products.length === 0 ? (
          <Empty description={t('common.noData')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {products.map((product: any) => (
              <Card key={product.id} size="small" hoverable style={{ borderRadius: 8, cursor: 'pointer' }}
                onClick={() => selectProduct(product)}>
                <Row gutter={12} align="middle">
                  <Col flex="none">
                    {product.images?.[0]?.url ? (
                      <Avatar size={56} src={product.images[0].url} shape="square" style={{ borderRadius: 6 }} />
                    ) : (
                      <Avatar size={56} shape="square" style={{ borderRadius: 6, background: '#f0f0f0', color: '#999' }}>{product.sku?.slice(0, 3)}</Avatar>
                    )}
                  </Col>
                  <Col flex="auto">
                    <Text strong style={{ display: 'block', fontSize: 14 }}>{product.name}</Text>
                    <Space size={8} wrap>
                      <Tag style={{ borderRadius: 4 }}>{product.sku}</Tag>
                      {product.category?.name && <Tag color="blue" style={{ borderRadius: 4 }}>{product.category.name}</Tag>}
                      {product.capacity_ml && <Text type="secondary">{product.capacity_ml}ml</Text>}
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <Text type="success" strong>{formatVND(product.retail_price)}</Text>
                    </div>
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default CreatePurchaseOrderPage;
