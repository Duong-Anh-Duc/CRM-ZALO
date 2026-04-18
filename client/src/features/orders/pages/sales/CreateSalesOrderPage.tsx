import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Select, DatePicker, Input, InputNumber, Button, Space, Row, Col, Typography, Drawer, Avatar, Tag, Empty, Divider, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, ArrowLeftOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateSalesOrder } from '../../hooks';
import { useCustomers } from '@/features/customers/hooks';
import { useProducts } from '@/features/products/hooks';
import { formatVND } from '@/utils/format';

const { Text, Title } = Typography;

const vatOptions = [
  { label: '0%', value: 0 },
  { label: '5%', value: 5 },
  { label: '8%', value: 8 },
  { label: '10%', value: 10 },
];

interface OrderItem {
  key: number;
  customer_name?: string;
  product_id?: string;
  product?: any;
  supplier_id?: string;
  supplier_name?: string;
  purchase_price?: number;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  vat_rate: number;
}

const CreateSalesOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const createMutation = useCreateSalesOrder();

  const [items, setItems] = useState<OrderItem[]>([{ key: Date.now(), quantity: 1, unit_price: 0, discount_pct: 0, vat_rate: 10 }]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeItemKey, setActiveItemKey] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productMaterial, setProductMaterial] = useState('');
  const [productColor, setProductColor] = useState('');
  const [productShape, setProductShape] = useState('');
  const [productNeck, setProductNeck] = useState('');
  const [capRange, setCapRange] = useState<[number | null, number | null]>([null, null]);
  const [priceRange, setPriceRange] = useState<[number | null, number | null]>([null, null]);

  const { data: customersData } = useCustomers({ limit: 200 });
  const customers = (customersData?.data ?? []) as any[];
  const selectedCustomerId = Form.useWatch('customer_id', form);

  const { data: customerPricesData } = useQuery({
    queryKey: ['customer-product-prices', selectedCustomerId],
    queryFn: async () => apiClient.get('/customer-product-prices', { params: { customer_id: selectedCustomerId } }),
    enabled: !!selectedCustomerId,
  });
  const customerPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    const list = (customerPricesData?.data as any)?.data || [];
    list.forEach((cp: any) => map.set(cp.product_id, Number(cp.price)));
    return map;
  }, [customerPricesData]);

  const { data: productsData } = useProducts({
    limit: 50,
    search: productSearch || undefined,
    category_id: productCategory || undefined,
    material: productMaterial || undefined,
    color: productColor || undefined,
    shape: productShape || undefined,
    neck_type: productNeck || undefined,
    capacity_ml_min: capRange[0] ?? undefined,
    capacity_ml_max: capRange[1] ?? undefined,
    price_min: priceRange[0] ?? undefined,
    price_max: priceRange[1] ?? undefined,
  } as any);
  const products = (productsData?.data ?? []) as any[];

  const categories = [...new Map<string, any>(products.filter((p: any) => p.category?.id).map((p: any) => [p.category.id, p.category])).values()];

  const customerOptions = customers.map((c: any) => ({
    label: `${c.company_name || c.contact_name} ${c.phone ? '- ' + c.phone : ''}`,
    value: c.id,
  }));

  const openProductSearch = (itemKey: number) => {
    setActiveItemKey(itemKey);
    setProductSearch('');
    setProductCategory('');
    setProductMaterial('');
    setDrawerOpen(true);
  };

  const selectProduct = (product: any) => {
    const preferred = product.supplier_prices?.find((sp: any) => sp.is_preferred);
    const firstSupplier = product.supplier_prices?.[0];
    const supplier = preferred || firstSupplier;
    const savedPrice = customerPriceMap.get(product.id);

    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== activeItemKey) return item;
        return {
          ...item,
          product_id: product.id,
          product,
          unit_price: savedPrice ?? (product.retail_price || 0),
          supplier_id: supplier?.supplier_id || undefined,
          supplier_name: supplier?.supplier?.company_name || undefined,
          purchase_price: supplier?.purchase_price || undefined,
          customer_name: item.customer_name || product.aliases?.[0]?.alias || '',
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
    setItems((prev) => [...prev, { key: Date.now(), quantity: 1, unit_price: 0, discount_pct: 0, vat_rate: 10 }]);
  };

  const removeItem = (key: number) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const lineTotal = (item: OrderItem) => {
    const sub = item.quantity * item.unit_price;
    return sub - sub * (item.discount_pct / 100);
  };

  const lineVat = (item: OrderItem) => lineTotal(item) * (item.vat_rate / 100);
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const totalVat = items.reduce((sum, item) => sum + lineVat(item), 0);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const validItems = items.filter((item) => item.product_id);

      if (validItems.length === 0) { message.error(t('order.minOneItem')); return; }
      if (items.some((item) => !item.product_id)) { message.error(t('order.invalidProduct')); return; }
      if (items.some((item) => !item.customer_name?.trim())) { message.error(t('validation.customerProductNameRequired')); return; }
      if (items.some((item) => !item.quantity || item.quantity <= 0)) { message.error(t('validation.qtyPositive')); return; }
      if (items.some((item) => !item.unit_price || item.unit_price <= 0)) { message.error(t('validation.unitPricePositive')); return; }

      const shippingFee = values.shipping_fee || 0;
      const otherFee = values.other_fee || 0;

      const payload = {
        customer_id: values.customer_id,
        expected_delivery: values.expected_delivery?.format('YYYY-MM-DD'),
        notes: values.notes,
        vat_rate: 'VAT_0' as any,
        shipping_fee: shippingFee,
        other_fee: otherFee,
        items: validItems.map((item) => ({
          product_id: item.product_id,
          supplier_id: item.supplier_id || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
          purchase_price: item.purchase_price || undefined,
          discount_pct: item.discount_pct || 0,
          vat_rate: item.vat_rate ?? 10,
          customer_product_name: item.customer_name || undefined,
        })),
      };
      createMutation.mutate(payload, {
        onSuccess: (res: any) => {
          const newId = res?.data?.id || res?.id;
          if (newId) navigate(`/sales-orders/${newId}`);
          else navigate('/sales-orders');
        },
      });
    } catch {
      // validation
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/sales-orders')} />
        <Title level={4} style={{ margin: 0 }}>{t('order.createSalesOrder')}</Title>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Form form={form} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={10}>
              <Form.Item name="customer_id" label={t('order.customer')} rules={[{ required: true, message: t('validation.customerRequired') }]}>
                <Select showSearch optionFilterProp="label" options={customerOptions} placeholder={t('order.selectCustomer')} style={{ borderRadius: 8 }} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="expected_delivery" label={t('order.expectedDelivery')}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} size="large" />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="shipping_fee" label={t('order.shippingFee')}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
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
            <Card key={item.key} size="small" style={{
              borderRadius: 12, marginBottom: 12,
              border: !item.product_id ? '1px dashed #ff4d4f' : '1px solid #e8e8e8',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {/* Header: STT + Delete */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600, fontSize: 12 }}>#{index + 1}</Tag>
                {items.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeItem(item.key)} />}
              </div>

              {/* Product selector */}
              <div onClick={() => openProductSearch(item.key)} style={{
                border: '1px dashed #d9d9d9', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', marginBottom: 12,
                background: item.product ? '#f6ffed' : '#fafafa',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'border-color 0.2s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1677ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d9d9d9'; }}
              >
                {item.product ? (
                  <>
                    {item.product.images?.[0]?.url ? (
                      <Avatar size={44} src={item.product.images[0].url} shape="square" style={{ borderRadius: 8, flexShrink: 0 }} />
                    ) : (
                      <Avatar size={44} shape="square" style={{ borderRadius: 8, background: '#e6f4ff', color: '#1677ff', flexShrink: 0 }}>{item.product.sku?.slice(0, 3)}</Avatar>
                    )}
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 14, display: 'block' }}>{item.product.name}</Text>
                      <Space size={6}>
                        <Tag style={{ borderRadius: 4, fontSize: 11 }}>{item.product.sku}</Tag>
                        {item.product.material && <Tag color="geekblue" style={{ borderRadius: 4, fontSize: 10 }}>{item.product.material}</Tag>}
                        {item.product.capacity_ml && <Text type="secondary" style={{ fontSize: 11 }}>{item.product.capacity_ml}ml</Text>}
                      </Space>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{t('product.retailPrice')}</Text>
                      <Text strong style={{ fontSize: 13 }}>{formatVND(item.product.retail_price)}</Text>
                      {customerPriceMap.has(item.product.id) && (
                        <>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{t('product.savedCustomerPrice')}</Text>
                          <Text type="success" strong style={{ fontSize: 13 }}>{formatVND(customerPriceMap.get(item.product.id)!)}</Text>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: 4 }}>
                    <SearchOutlined style={{ fontSize: 16, color: '#1677ff' }} />
                    <Text type="secondary">{t('order.searchProduct')}</Text>
                  </div>
                )}
              </div>

              {/* Form fields */}
              <Row gutter={[10, 10]}>
                <Col xs={24} sm={12}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('order.customerProductName')} <span style={{ color: '#ff4d4f' }}>*</span></div>
                  <Input value={item.customer_name} onChange={(e) => updateItem(item.key, 'customer_name', e.target.value)} placeholder={t('order.customerProductName')} style={{ borderRadius: 8 }} />
                </Col>
                <Col xs={12} sm={6}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('order.qty')} <span style={{ color: '#ff4d4f' }}>*</span></div>
                  <InputNumber min={1} value={item.quantity} onChange={(v) => updateItem(item.key, 'quantity', v || 1)} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
                <Col xs={12} sm={6}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('order.unitPrice')} <span style={{ color: '#ff4d4f' }}>*</span></div>
                  <InputNumber min={0} value={item.unit_price} onChange={(v) => updateItem(item.key, 'unit_price', v || 0)} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any} style={{ width: '100%', borderRadius: 8 }} addonAfter="₫" />
                </Col>
                <Col xs={8} sm={4}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>CK%</div>
                  <InputNumber min={0} max={100} value={item.discount_pct} onChange={(v) => updateItem(item.key, 'discount_pct', v || 0)} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
                <Col xs={8} sm={4}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>VAT</div>
                  <Select value={item.vat_rate} onChange={(v) => updateItem(item.key, 'vat_rate', v)} options={vatOptions} style={{ width: '100%' }} />
                </Col>
                <Col xs={24}>
                  <div style={{ background: '#f6ffed', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>{t('order.lineTotal')}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Text strong style={{ fontSize: 16, color: '#52c41a' }}>{formatVND(lineTotal(item))}</Text>
                      {item.vat_rate > 0 && <Text type="secondary" style={{ fontSize: 11 }}>+VAT {formatVND(lineVat(item))}</Text>}
                    </div>
                  </div>
                </Col>
                {item.product && (
                  <Col xs={24}>
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('order.supplier')}</div>
                    <Select value={item.supplier_id || undefined}
                      onChange={(v) => {
                        const sp = item.product?.supplier_prices?.find((s: any) => s.supplier_id === v);
                        updateItem(item.key, 'supplier_id', v);
                        updateItem(item.key, 'supplier_name', sp?.supplier?.company_name || '');
                        updateItem(item.key, 'purchase_price', sp?.purchase_price || undefined);
                      }}
                      allowClear placeholder={t('order.assignLater')} style={{ width: '100%', borderRadius: 8 }}
                      options={(item.product?.supplier_prices || []).map((sp: any) => ({
                        label: `${sp.supplier?.company_name} — ${formatVND(sp.purchase_price)}${sp.is_preferred ? ' ★' : ''}`,
                        value: sp.supplier_id,
                      }))} />
                  </Col>
                )}
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
              <Text>{t('order.subtotalLabel')}: {formatVND(subtotal)}</Text>
              {totalVat > 0 && <Text>VAT: {formatVND(totalVat)}</Text>}
              <Text strong style={{ fontSize: 18 }}>{t('order.grandTotal')}: {formatVND(subtotal + totalVat + (form.getFieldValue('shipping_fee') || 0) + (form.getFieldValue('other_fee') || 0))}</Text>
              <Space size={12} style={{ marginTop: 12 }}>
                <Button size="large" onClick={() => navigate('/sales-orders')} style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
                <Button type="primary" size="large" loading={createMutation.isPending} onClick={handleSubmit} style={{ borderRadius: 8 }} icon={<ShoppingOutlined />}>
                  {t('order.createSalesOrder')}
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Product Search Drawer */}
      <Drawer title={t('order.searchProduct')} placement="right" width={window.innerWidth < 640 ? '100%' : 620} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Input prefix={<SearchOutlined />} placeholder={t('order.searchProductPlaceholder')} value={productSearch} onChange={(e) => setProductSearch(e.target.value)} allowClear size="large" style={{ borderRadius: 8, marginBottom: 12 }} autoFocus />
        <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
          <Col xs={12}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('product.category')}</div>
            <Select value={productCategory} onChange={setProductCategory} placeholder={t('common.all')} allowClear style={{ width: '100%', borderRadius: 8 }}
              options={categories.map((c: any) => ({ label: c?.name, value: c?.id }))} />
          </Col>
          <Col xs={12}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('product.material')}</div>
            <Select value={productMaterial} onChange={setProductMaterial} placeholder={t('common.all')} allowClear style={{ width: '100%', borderRadius: 8 }}
              options={['PET', 'HDPE', 'LDPE', 'PP', 'PVC', 'PS', 'PC', 'OTHER'].map((v) => ({ label: v, value: v }))} />
          </Col>
          <Col xs={12}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('product.color')}</div>
            <Select value={productColor} onChange={setProductColor} placeholder={t('common.all')} allowClear style={{ width: '100%', borderRadius: 8 }}
              options={['TRANSPARENT', 'WHITE', 'BLACK', 'BLUE', 'GREEN', 'RED', 'YELLOW', 'CUSTOM'].map((v) => ({ label: t(`colorLabels.${v}`, v), value: v }))} />
          </Col>
          <Col xs={12}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('product.shape')}</div>
            <Select value={productShape} onChange={setProductShape} placeholder={t('common.all')} allowClear style={{ width: '100%', borderRadius: 8 }}
              options={['ROUND', 'SQUARE', 'OVAL', 'RECTANGLE', 'CUSTOM'].map((v) => ({ label: t(`shapeLabels.${v}`, v), value: v }))} />
          </Col>
          <Col xs={12}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('product.neckType')}</div>
            <Select value={productNeck} onChange={setProductNeck} placeholder={t('common.all')} allowClear style={{ width: '100%', borderRadius: 8 }}
              options={['WIDE', 'NARROW', 'PUMP', 'SPRAY', 'SCREW', 'FLIP', 'CUSTOM'].map((v) => ({ label: t(`neckLabels.${v}`, v), value: v }))} />
          </Col>
          <Col xs={12}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('product.capacity')} (ml)</div>
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber min={0} placeholder={t('common.min')} value={capRange[0]}
                onChange={(v) => setCapRange([v ?? null, capRange[1]])} style={{ width: '50%' }} />
              <InputNumber min={0} placeholder={t('common.max')} value={capRange[1]}
                onChange={(v) => setCapRange([capRange[0], v ?? null])} style={{ width: '50%' }} />
            </Space.Compact>
          </Col>
          <Col xs={24}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{t('product.retailPrice')} (VND)</div>
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber min={0} placeholder={t('common.min')} value={priceRange[0]} style={{ width: '50%' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any}
                onChange={(v) => setPriceRange([v ?? null, priceRange[1]])} />
              <InputNumber min={0} placeholder={t('common.max')} value={priceRange[1]} style={{ width: '50%' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any}
                onChange={(v) => setPriceRange([priceRange[0], v ?? null])} />
            </Space.Compact>
          </Col>
        </Row>
        <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
          <Text type="secondary">{products.length} {t('product.results')}</Text>
          <Button size="small" type="link" onClick={() => {
            setProductSearch(''); setProductCategory(''); setProductMaterial('');
            setProductColor(''); setProductShape(''); setProductNeck('');
            setCapRange([null, null]); setPriceRange([null, null]);
          }}>{t('common.reset')}</Button>
        </Space>
        {products.length === 0 ? <Empty description={t('common.noData')} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {products.map((product: any) => (
              <Card key={product.id} size="small" hoverable style={{ borderRadius: 8, cursor: 'pointer' }} onClick={() => selectProduct(product)}>
                <Row gutter={12} align="middle">
                  <Col flex="none">
                    {product.images?.[0]?.url ? <Avatar size={56} src={product.images[0].url} shape="square" style={{ borderRadius: 6 }} /> : <Avatar size={56} shape="square" style={{ borderRadius: 6, background: '#f0f0f0', color: '#999' }}>{product.sku?.slice(0, 3)}</Avatar>}
                  </Col>
                  <Col flex="auto">
                    <Text strong style={{ display: 'block', fontSize: 14 }}>{product.name}</Text>
                    <Space size={8} wrap>
                      <Tag style={{ borderRadius: 4 }}>{product.sku}</Tag>
                      {product.category?.name && <Tag color="blue" style={{ borderRadius: 4 }}>{product.category.name}</Tag>}
                      {product.capacity_ml && <Text type="secondary">{product.capacity_ml}ml</Text>}
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{t('product.retailPrice')}: </Text>
                        <Text strong>{formatVND(product.retail_price)}</Text>
                      </div>
                      {customerPriceMap.has(product.id) && (
                        <div style={{ marginTop: 2 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{t('product.savedCustomerPrice')}: </Text>
                          <Text type="success" strong>{formatVND(customerPriceMap.get(product.id)!)}</Text>
                        </div>
                      )}
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

export default CreateSalesOrderPage;
