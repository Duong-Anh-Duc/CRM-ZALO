import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Space, Table, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useSuppliers, useDeleteSupplier } from '../hooks';
import { Supplier } from '@/types';
import { formatVND } from '@/utils/format';
import { PageHeader } from '@/components/common';
import SupplierFormModal from '../components/SupplierFormModal';

const SupplierListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | undefined>(undefined);

  const { data, isLoading, refetch } = useSuppliers({ search, page, limit: pageSize });
  const deleteMutation = useDeleteSupplier();

  const suppliers: Supplier[] = data?.data ?? [];
  const meta = data?.meta;

  const columns: ColumnsType<Supplier> = [
    {
      title: t('supplier.name'),
      dataIndex: 'company_name',
      key: 'company_name',
      ellipsis: true,
    },
    {
      title: t('customer.phoneShort'),
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
    },
    {
      title: t('supplier.productsCount'),
      dataIndex: 'products_count',
      key: 'products_count',
      width: 130,
      align: 'center',
      render: (val: number) => val ?? 0,
    },
    {
      title: t('supplier.totalPayable'),
      dataIndex: 'total_payable',
      key: 'total_payable',
      width: 160,
      align: 'right',
      render: (val: number) => formatVND(val),
    },
    {
      title: t('customer.overdue'),
      dataIndex: 'overdue_amount',
      key: 'overdue_amount',
      width: 160,
      align: 'right',
      render: (val: number) => (
        <span style={{ color: val ? '#ff4d4f' : undefined, fontWeight: val ? 600 : 400 }}>
          {formatVND(val)}
        </span>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: Supplier) => (
        <Space size="small">
          <Tooltip title={t('common.viewDetail')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: '#1677ff' }}
              onClick={() => navigate(`/suppliers/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('common.editRecord')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: '#faad14' }}
              onClick={() => {
                setEditSupplier(record);
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
          title={t('supplier.title')}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ borderRadius: 8 }}
              onClick={() => setModalOpen(true)}
            >
              {t('supplier.addSupplier')}
            </Button>
          }
        />

        <Input
          placeholder={t('supplier.searchPlaceholder')}
          prefix={<SearchOutlined />}
          allowClear
          style={{ marginBottom: 16, borderRadius: 8, maxWidth: 400 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <Table<Supplier>
          rowKey="id"
          columns={columns}
          dataSource={suppliers}
          loading={isLoading}
          style={{ borderRadius: 12 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: meta?.total ?? 0,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => t('supplier.totalSuppliers', { count: total }),
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <SupplierFormModal
        open={modalOpen}
        supplier={editSupplier}
        onClose={() => {
          setModalOpen(false);
          setEditSupplier(undefined);
        }}
        onSuccess={() => {
          setModalOpen(false);
          setEditSupplier(undefined);
          refetch();
        }}
      />
    </>
  );
};

export default SupplierListPage;
