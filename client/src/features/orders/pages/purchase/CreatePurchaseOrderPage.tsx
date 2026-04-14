import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Select, DatePicker, Input, InputNumber, Button, Space, Row, Col, Typography, Drawer, Avatar, Tag, Empty, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, ArrowLeftOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreatePurchaseOrder } from '../../hooks';
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
          unit_price: product.wholesale_price || product.retail_price || 0,
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
      if (validItems.length === 0) return;

      const payload = {
        supplier_id: values.supplier_id,
        expected_delivery: values.expected_delivery?.format('YYYY-MM-DD'),
        notes: values.notes,
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
            <Col xs={24} md={12}>
              <Form.Item name="supplier_id" label={t('order.supplier')} rules={[{ required: true, message: t('validation.supplierRequired') }]}>
                <Select showSearch optionFilterProp="label" options={supplierOptions} placeholder={t('order.selectSupplier')} style={{ borderRadius: 8 }} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="expected_delivery" label={t('order.expectedDelivery')}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} size="large" />
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
              <Row gutter={[8, 8]} align="middle">
                <Col flex="none"><Text type="secondary" style={{ width: 20, display: 'inline-block' }}>{index + 1}</Text></Col>

                {/* Product from system */}
                <Col xs={24} sm={8}>
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

                <Col xs={6} sm={3}>
                  <InputNumber min={1} value={item.quantity} onChange={(v) => updateItem(item.key, 'quantity', v || 1)}
                    placeholder={t('order.quantity')} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
                <Col xs={8} sm={4}>
                  <InputNumber min={0} value={item.unit_price} onChange={(v) => updateItem(item.key, 'unit_price', v || 0)}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(v) => Number(v?.replace(/\./g, '') ?? 0)}
                    placeholder={t('product.unitPrice')} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
                <Col xs={0} sm={3}>
                  <Text strong style={{ whiteSpace: 'nowrap' }}>{formatVND(lineTotal(item))}</Text>
                </Col>
                <Col flex="none">
                  {items.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeItem(item.key)} />}
                </Col>
              </Row>
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
                      <Text type="success" strong>{formatVND(product.wholesale_price || product.retail_price)}</Text>
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
