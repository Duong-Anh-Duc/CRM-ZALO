import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Select, DatePicker, Input, InputNumber, Button, Space, Row, Col, Typography, Drawer, Avatar, Tag, Empty, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, ArrowLeftOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateSalesOrder } from '../../hooks';
import { useCustomers } from '@/features/customers/hooks';
import { useProducts } from '@/features/products/hooks';
import { formatVND } from '@/utils/format';

const { Text, Title } = Typography;

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
}

const CreateSalesOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const createMutation = useCreateSalesOrder();

  const [items, setItems] = useState<OrderItem[]>([{ key: Date.now(), quantity: 1, unit_price: 0, discount_pct: 0 }]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeItemKey, setActiveItemKey] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productMaterial, setProductMaterial] = useState('');

  const { data: customersData } = useCustomers({ limit: 200 });
  const customers = (customersData?.data ?? []) as any[];

  const { data: productsData } = useProducts({
    limit: 50,
    search: productSearch || undefined,
    category_id: productCategory || undefined,
    material: productMaterial || undefined,
  });
  const products = (productsData?.data ?? []) as any[];

  // Get categories for filter
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
    // Tìm NCC preferred
    const preferred = product.supplier_prices?.find((sp: any) => sp.is_preferred);
    const firstSupplier = product.supplier_prices?.[0];
    const supplier = preferred || firstSupplier;

    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== activeItemKey) return item;
        const autoName = item.customer_name || product.aliases?.[0]?.alias || '';
        return {
          ...item,
          product_id: product.id,
          product,
          unit_price: product.retail_price || product.wholesale_price || 0,
          supplier_id: supplier?.supplier_id || undefined,
          supplier_name: supplier?.supplier?.company_name || undefined,
          purchase_price: supplier?.purchase_price || undefined,
          customer_name: autoName,
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
    setItems((prev) => [...prev, { key: Date.now(), quantity: 1, unit_price: 0, discount_pct: 0 }]);
  };

  const removeItem = (key: number) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const lineTotal = (item: OrderItem) => {
    const sub = item.quantity * item.unit_price;
    return sub - sub * (item.discount_pct / 100);
  };

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const validItems = items.filter((item) => item.product_id);
      if (validItems.length === 0) return;

      const payload = {
        customer_id: values.customer_id,
        expected_delivery: values.expected_delivery?.format('YYYY-MM-DD'),
        notes: values.notes,
        vat_rate: values.vat_rate,
        items: validItems.map((item) => ({
          product_id: item.product_id,
          supplier_id: item.supplier_id || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
          purchase_price: item.purchase_price || undefined,
          discount_pct: item.discount_pct || 0,
          customer_product_name: item.customer_name || undefined,
        })),
      };
      createMutation.mutate(payload, {
        onSuccess: () => navigate('/sales-orders'),
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
        <Form form={form} layout="vertical" initialValues={{ vat_rate: 'VAT_10' }}>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="customer_id" label={t('order.customer')} rules={[{ required: true, message: t('validation.customerRequired') }]}>
                <Select showSearch optionFilterProp="label" options={customerOptions} placeholder={t('order.selectCustomer')} style={{ borderRadius: 8 }} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="expected_delivery" label={t('order.expectedDelivery')}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="vat_rate" label="VAT" rules={[{ required: true }]}>
                <Select size="large" options={[{ label: '0%', value: 'VAT_0' }, { label: '8%', value: 'VAT_8' }, { label: '10%', value: 'VAT_10' }]} />
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
            <Card key={item.key} size="small" style={{ borderRadius: 8, marginBottom: 8, border: '1px solid #f0f0f0' }}>
              {/* Dòng 1: STT + Tên KH gọi + Sản phẩm + Xoá */}
              <Row gutter={[8, 8]} align="middle">
                <Col flex="none"><Text type="secondary" style={{ width: 24, display: 'inline-block', textAlign: 'center' }}>{index + 1}</Text></Col>
                <Col xs={11} sm={8}>
                  <Input placeholder={t('order.customerProductName')} value={item.customer_name}
                    onChange={(e) => updateItem(item.key, 'customer_name', e.target.value)} style={{ borderRadius: 8 }} />
                </Col>
                <Col xs={11} sm={10}>
                  <div onClick={() => openProductSearch(item.key)}
                    style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: '4px 11px', cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center', gap: 8, background: item.product ? '#fff' : '#fafafa' }}>
                    {item.product ? (
                      <Space size={6}>
                        {item.product.images?.[0]?.url && <Avatar size={24} src={item.product.images[0].url} shape="square" />}
                        <Text ellipsis style={{ maxWidth: 200 }}><Text type="secondary">{item.product.sku}</Text> {item.product.name}</Text>
                      </Space>
                    ) : (
                      <Text type="secondary"><SearchOutlined style={{ marginRight: 4 }} />{t('order.searchProduct')}</Text>
                    )}
                  </div>
                </Col>
                <Col flex="none">
                  {items.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeItem(item.key)} />}
                </Col>
              </Row>
              {/* Dòng 2: SL + Đơn giá + CK% + Thành tiền */}
              <Row gutter={[8, 0]} align="middle" style={{ marginTop: 8, paddingLeft: 32 }}>
                <Col xs={8} sm={5}>
                  <InputNumber min={1} value={item.quantity} onChange={(v) => updateItem(item.key, 'quantity', v || 1)}
                    placeholder="0" addonBefore={t('order.qty')} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
                <Col xs={10} sm={6}>
                  <InputNumber min={0} value={item.unit_price} onChange={(v) => updateItem(item.key, 'unit_price', v || 0)}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(v) => Number(v?.replace(/\./g, '') ?? 0)}
                    placeholder="0" addonBefore={t('order.price')} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
                <Col xs={6} sm={4}>
                  <InputNumber min={0} max={100} value={item.discount_pct} onChange={(v) => updateItem(item.key, 'discount_pct', v || 0)}
                    placeholder="0" addonBefore="CK%" style={{ width: '100%', borderRadius: 8 }} />
                </Col>
                <Col xs={24} sm={5}>
                  <Text strong style={{ fontSize: 15 }}>{formatVND(lineTotal(item))}</Text>
                </Col>
              </Row>
              {/* NCC row — hiển thị khi đã chọn SP */}
              {item.product && (
                <div style={{ marginTop: 6, marginLeft: 28 }}>
                  <Space size={8} wrap>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('order.supplier')}:</Text>
                    <Select
                      size="small"
                      value={item.supplier_id || undefined}
                      onChange={(v) => {
                        const sp = item.product?.supplier_prices?.find((s: any) => s.supplier_id === v);
                        updateItem(item.key, 'supplier_id', v);
                        updateItem(item.key, 'supplier_name', sp?.supplier?.company_name || '');
                        updateItem(item.key, 'purchase_price', sp?.purchase_price || undefined);
                      }}
                      allowClear
                      placeholder={t('order.assignLater')}
                      style={{ minWidth: 200, borderRadius: 6 }}
                      options={(item.product?.supplier_prices || []).map((sp: any) => ({
                        label: `${sp.supplier?.company_name} — ${formatVND(sp.purchase_price)}${sp.is_preferred ? ' ★' : ''}`,
                        value: sp.supplier_id,
                      }))}
                    />
                    {item.purchase_price && <Text type="secondary" style={{ fontSize: 12 }}>{t('order.purchasePrice')}: {formatVND(item.purchase_price)}</Text>}
                  </Space>
                </div>
              )}
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
                <Button size="large" onClick={() => navigate('/sales-orders')} style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
                <Button type="primary" size="large" loading={createMutation.isPending} onClick={handleSubmit} style={{ borderRadius: 8 }} icon={<ShoppingOutlined />}>
                  {t('order.createSalesOrder')}
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Product Search Drawer — WIDE */}
      <Drawer
        title={t('order.searchProduct')}
        placement="right"
        width={window.innerWidth < 640 ? '100%' : 600}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {/* Search */}
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('order.searchProductPlaceholder')}
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          allowClear size="large" style={{ borderRadius: 8, marginBottom: 12 }} autoFocus
        />

        {/* Filters */}
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

        {/* Product list */}
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
                      {product.wholesale_price && <Text type="secondary" style={{ marginLeft: 8 }}>Sỉ: {formatVND(product.wholesale_price)}</Text>}
                    </div>
                    {product.aliases?.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {product.aliases.map((a: any, i: number) => (
                          <Tag key={i} color="orange" style={{ borderRadius: 4, fontSize: 11 }}>{a.alias}</Tag>
                        ))}
                      </div>
                    )}
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
