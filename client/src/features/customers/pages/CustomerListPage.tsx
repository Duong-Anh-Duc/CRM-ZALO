import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Table, Tag, Card, Space, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useCustomers, useDeleteCustomer } from '../hooks';
import { Customer } from '@/types';
import { formatVND, formatDate, customerTypeLabels } from '@/utils/format';
import { PageHeader } from '@/components/common';
import CustomerFormModal from '../components/CustomerFormModal';

const CustomerListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | undefined>(undefined);

  const { data, isLoading, refetch } = useCustomers({ search, page, limit: pageSize });
  const deleteMutation = useDeleteCustomer();

  const customers: Customer[] = data?.data ?? [];
  const meta = data?.meta;

  const columns: ColumnsType<Customer> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: t('customer.companyName'),
      dataIndex: 'company_name',
      key: 'company_name',
      ellipsis: true,
    },
    {
      title: t('customer.customerTypeShort'),
      dataIndex: 'customer_type',
      key: 'customer_type',
      width: 100,
      responsive: ['md'],
      render: (type: string) => (
        <Tag color="blue" style={{ borderRadius: 8 }}>
          {customerTypeLabels[type] ?? type}
        </Tag>
      ),
    },
    {
      title: t('customer.contactName'),
      dataIndex: 'contact_name',
      key: 'contact_name',
      ellipsis: true,
      responsive: ['md'],
    },
    {
      title: t('customer.phoneShort'),
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      responsive: ['md'],
    },
    {
      title: t('customer.totalReceivable'),
      dataIndex: 'total_receivable',
      key: 'total_receivable',
      width: 150,
      responsive: ['lg'],
      align: 'right',
      render: (val: number) => formatVND(val),
    },
    {
      title: t('customer.overdue'),
      dataIndex: 'overdue_amount',
      key: 'overdue_amount',
      width: 150,
      responsive: ['lg'],
      align: 'right',
      render: (val: number) => (
        <span style={{ color: val ? '#ff4d4f' : undefined, fontWeight: val ? 600 : 400 }}>
          {formatVND(val)}
        </span>
      ),
    },
    {
      title: t('customer.lastOrderDate'),
      dataIndex: 'last_order_date',
      key: 'last_order_date',
      width: 130,
      responsive: ['lg'],
      render: (val: string) => formatDate(val),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: Customer) => (
        <Space size="small">
          <Tooltip title={t('common.viewDetail')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: '#1677ff' }}
              onClick={() => navigate(`/customers/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('common.editRecord')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: '#faad14' }}
              onClick={() => {
                setEditCustomer(record);
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
          title={t('customer.title')}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ borderRadius: 8 }}
              onClick={() => setModalOpen(true)}
            >
              {t('customer.addCustomer')}
            </Button>
          }
        />

        <Input
          placeholder={t('customer.searchPlaceholder')}
          prefix={<SearchOutlined />}
          allowClear
          style={{ marginBottom: 16, borderRadius: 8, maxWidth: 400 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <Table<Customer>
          rowKey="id"
          columns={columns}
          dataSource={customers}
          loading={isLoading}
          style={{ borderRadius: 12 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: meta?.total ?? 0,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => t('customer.totalCustomers', { count: total }),
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <CustomerFormModal
        open={modalOpen}
        customer={editCustomer}
        onClose={() => {
          setModalOpen(false);
          setEditCustomer(undefined);
        }}
        onSuccess={() => {
          setModalOpen(false);
          setEditCustomer(undefined);
          refetch();
        }}
      />
    </>
  );
};

export default CustomerListPage;
