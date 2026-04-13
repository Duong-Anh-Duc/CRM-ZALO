import React, { useState } from 'react';
import { Button, Input, Select, Table, Tag, Card, Space, Spin, Empty, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useProducts, useDeleteProduct } from '../hooks';
import { productApi } from '../api';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { Product, PlasticMaterial, Category } from '@/types';
import { formatVND, materialLabels } from '@/utils/format';
import { PageHeader } from '@/components/common';
import ProductFormModal from '../components/ProductFormModal';

const cardStyle: React.CSSProperties = { borderRadius: 12 };

const materialOptions: { value: PlasticMaterial; label: string }[] = [
  { value: 'PET', label: 'PET' },
  { value: 'HDPE', label: 'HDPE' },
  { value: 'PP', label: 'PP' },
  { value: 'PVC', label: 'PVC' },
  { value: 'PS', label: 'PS' },
  { value: 'ABS', label: 'ABS' },
];

const ProductListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole('ADMIN', 'STAFF');

  const [search, setSearch] = useState('');
  const [material, setMaterial] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [supplierId, setSupplierId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, refetch } = useProducts({ search, material, category_id: categoryId, supplier_id: supplierId, page, limit: pageSize });
  const { data: categoriesData } = useQuery<Category[]>({
    queryKey: ['product-categories'],
    queryFn: () => productApi.list({ type: 'categories' }).then((r) => r.data.data ?? []),
  });
  const categoryOptions = (categoriesData ?? []).map((c: Category) => ({ value: c.id, label: c.name }));
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-for-filter'],
    queryFn: () => apiClient.get('/suppliers', { params: { limit: 100 } }).then((r) => r.data.data ?? []),
  });
  const supplierOptions = (suppliersData ?? []).map((s: any) => ({ value: s.id, label: s.company_name }));
  const deleteMutation = useDeleteProduct();

  const products: Product[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;

  const columns: any[] = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 130,
    },
    {
      title: t('product.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('product.material'),
      dataIndex: 'material',
      key: 'material',
      width: 100,
      responsive: ['md'],
      render: (v: string) => (v ? materialLabels[v] ?? v : '-'),
    },
    {
      title: t('product.capacityMl'),
      dataIndex: 'capacity_ml',
      key: 'capacity_ml',
      width: 120,
      responsive: ['lg'],
      align: 'right' as const,
      render: (v: number | undefined) => (v != null ? v : '-'),
    },
    {
      title: t('product.retailPrice'),
      dataIndex: 'retail_price',
      key: 'retail_price',
      width: 140,
      responsive: ['md'],
      align: 'right' as const,
      render: (v: number | undefined) => (v != null ? formatVND(v) : '-'),
    },
    {
      title: t('product.wholesalePrice'),
      dataIndex: 'wholesale_price',
      key: 'wholesale_price',
      width: 140,
      responsive: ['lg'],
      align: 'right' as const,
      render: (v: number | undefined) => (v != null ? formatVND(v) : '-'),
    },
    {
      title: t('product.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 110,
      render: (active: boolean) => (
        <Tag
          color={active ? 'green' : 'default'}
          style={{ borderRadius: 8 }}
        >
          {active ? t('product.active') : t('product.inactive')}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: Product) => (
        <Space size="small">
          <Tooltip title={t('common.viewDetail')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: '#1677ff' }}
              onClick={() => navigate(`/products/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('common.editRecord')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: '#faad14' }}
              onClick={() => {
                setEditProduct(record);
                setModalOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title={t('common.deleteConfirm')}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title={t('common.deleteRecord')}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card style={{ borderRadius: 12 }}>
        <PageHeader
          title={t('product.management')}
          extra={
            canManage ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ borderRadius: 8 }}
                onClick={() => { setEditProduct(null); setModalOpen(true); }}
              >
                {t('product.addProduct')}
              </Button>
            ) : undefined
          }
        />

        {/* Filters */}
        <Space wrap style={{ marginBottom: 16, width: '100%' }}>
          <Input
            placeholder={t('product.searchPlaceholder')}
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 260, borderRadius: 8 }}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            placeholder={t('product.material')}
            allowClear
            style={{ width: 150, borderRadius: 8 }}
            options={materialOptions}
            value={material}
            onChange={(v) => {
              setMaterial(v);
              setPage(1);
            }}
          />
          <Select
            placeholder={t('product.category')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200, borderRadius: 8 }}
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              setPage(1);
            }}
            options={categoryOptions}
          />
          <Select
            placeholder={t('product.supplier')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 220, borderRadius: 8 }}
            value={supplierId}
            onChange={(v) => {
              setSupplierId(v);
              setPage(1);
            }}
            options={supplierOptions}
          />
        </Space>

        {/* Table */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" tip={t('common.loading')} />
          </div>
        ) : (
          <Table
            dataSource={products}
            columns={columns}
            rowKey="id"
            style={cardStyle}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (total) => t('product.totalProducts', { count: total }),
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{ emptyText: <Empty description={t('product.noProducts')} /> }}
          />
        )}
      </Card>

      <ProductFormModal
        open={modalOpen}
        product={editProduct}
        onClose={() => {
          setModalOpen(false);
          setEditProduct(null);
        }}
        onSuccess={() => {
          setModalOpen(false);
          setEditProduct(null);
          refetch();
        }}
      />
    </>
  );
};

export default ProductListPage;
