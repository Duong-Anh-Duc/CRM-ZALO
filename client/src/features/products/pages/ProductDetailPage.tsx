import React from 'react';
import {
  Card, Descriptions, Table, Tag, Spin, Empty, Space
} from 'antd';
import { StarFilled } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct, useCompatibleCaps } from '../hooks';
import { Product, PriceTier, SupplierPrice } from '@/types';
import { formatVND, materialLabels, formatNumber } from '@/utils/format';

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  marginBottom: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const ProductDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: productData, isLoading } = useProduct(id);
  const product = productData?.data as Product | undefined;

  const { data: capsData } = useCompatibleCaps(id);
  const compatibleCaps = capsData?.data as Product[] | undefined;

  const colorLabel = (key: string) => t(`colorLabels.${key}`);
  const shapeLabel = (key: string) => t(`shapeLabels.${key}`);
  const neckLabel = (key: string) => t(`neckLabels.${key}`);
  const unitLabel = (key: string) => t(`unitLabels.${key}`);
  const industryLabel = (key: string) => t(`industryLabels.${key}`);
  const safetyLabel = (key: string) => t(`safetyLabels.${key}`);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  if (!product) {
    return <Empty description={t('product.notFound')} style={{ marginTop: 80 }} />;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* General info */}
      <Card title={t('product.generalInfo')} style={cardStyle}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
          <Descriptions.Item label="SKU">{product.sku}</Descriptions.Item>
          <Descriptions.Item label={t('product.name')}>{product.name}</Descriptions.Item>
          <Descriptions.Item label={t('product.category')}>
            {product.category?.name ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.description')} span={3}>
            {product.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.status')}>
            <Tag color={product.is_active ? 'green' : 'default'} style={{ borderRadius: 8 }}>
              {product.is_active ? t('product.active') : t('product.inactive')}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Technical specs */}
      <Card title={t('product.technicalSpecs')} style={cardStyle}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
          <Descriptions.Item label={t('product.material')}>
            {product.material ? materialLabels[product.material] : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.capacity')}>
            {product.capacity_ml != null ? `${formatNumber(product.capacity_ml)} ml` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.height')}>
            {product.height_mm != null ? `${product.height_mm} mm` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.bodyDiameter')}>
            {product.body_dia_mm != null ? `${product.body_dia_mm} mm` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.neckDiameter')}>
            {product.neck_dia_mm != null ? `${product.neck_dia_mm} mm` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.weight')}>
            {product.weight_g != null ? `${product.weight_g} g` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.color')}>
            {product.color ? colorLabel(product.color) : '-'}
            {product.custom_color ? ` (${product.custom_color})` : ''}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.shape')}>
            {product.shape ? shapeLabel(product.shape) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.neckType')}>
            {product.neck_type ? neckLabel(product.neck_type) : '-'}
            {product.neck_spec ? ` - ${product.neck_spec}` : ''}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Packaging */}
      <Card title={t('product.packaging')} style={cardStyle}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
          <Descriptions.Item label={t('product.unitOfSale')}>
            {unitLabel(product.unit_of_sale)}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.pcsPerCarton')}>
            {product.pcs_per_carton ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.cartonWeight')}>
            {product.carton_weight != null ? `${product.carton_weight} kg` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.cartonDimensions')}>
            {product.carton_length && product.carton_width && product.carton_height
              ? `${product.carton_length} x ${product.carton_width} x ${product.carton_height} mm`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="MOQ">
            {product.moq != null ? formatNumber(product.moq) : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Application */}
      <Card title={t('product.application')} style={cardStyle}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t('product.industry')}>
            {product.industries.length > 0
              ? product.industries.map((i) => (
                  <Tag key={i} color="blue" style={{ borderRadius: 8 }}>
                    {industryLabel(i)}
                  </Tag>
                ))
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.safetyStandards')}>
            {product.safety_standards.length > 0
              ? product.safety_standards.map((s) => (
                  <Tag key={s} color="green" style={{ borderRadius: 8 }}>
                    {safetyLabel(s)}
                  </Tag>
                ))
              : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Price table */}
      <Card title={t('product.priceTable')} style={cardStyle}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label={t('product.retailPrice')}>
            {product.retail_price != null ? formatVND(product.retail_price) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('product.wholesalePrice')}>
            {product.wholesale_price != null ? formatVND(product.wholesale_price) : '-'}
          </Descriptions.Item>
        </Descriptions>
        <Table<PriceTier>
          dataSource={product.price_tiers}
          rowKey={(r) => r.id ?? `${r.min_qty}`}
          pagination={false}
          size="small"
          style={{ borderRadius: 12 }}
          columns={[
            { title: t('product.minQty'), dataIndex: 'min_qty', key: 'min_qty', render: (v) => formatNumber(v) },
            { title: t('product.unitPrice'), dataIndex: 'price', key: 'price', align: 'right', render: (v) => formatVND(v) },
          ]}
          locale={{ emptyText: <Empty description={t('product.noPriceTiers')} /> }}
        />
      </Card>

      {/* Supplier prices */}
      <Card title={t('product.supplierPrices')} style={cardStyle}>
        <Table<SupplierPrice>
          dataSource={product.supplier_prices}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ borderRadius: 12 }}
          columns={[
            { title: t('product.supplier'), dataIndex: ['supplier', 'company_name'], key: 'supplier' },
            { title: t('product.purchasePrice'), dataIndex: 'purchase_price', key: 'purchase_price', align: 'right', render: (v) => formatVND(v) },
            { title: 'MOQ', dataIndex: 'moq', key: 'moq', align: 'right', render: (v) => (v != null ? formatNumber(v) : '-') },
            { title: t('product.leadTime'), dataIndex: 'lead_time_days', key: 'lead_time_days', align: 'right', render: (v) => (v != null ? `${v} ${t('product.days')}` : '-') },
            {
              title: t('product.preferred'),
              dataIndex: 'is_preferred',
              key: 'is_preferred',
              align: 'center',
              render: (v: boolean) => v ? <StarFilled style={{ color: '#faad14' }} /> : null,
            },
          ]}
          locale={{ emptyText: <Empty description={t('product.noSupplierPrices')} /> }}
        />
      </Card>

      {/* Compatible caps */}
      <Card title={t('product.compatibleCaps')} style={cardStyle}>
        {compatibleCaps && compatibleCaps.length > 0 ? (
          <Space wrap>
            {compatibleCaps.map((cap) => (
              <Tag
                key={cap.id}
                color="purple"
                style={{ borderRadius: 8, cursor: 'pointer' }}
                onClick={() => navigate(`/products/${cap.id}`)}
              >
                {cap.sku} - {cap.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Empty description={t('product.noCompatibleCaps')} />
        )}
      </Card>

    </div>
  );
};

export default ProductDetailPage;
