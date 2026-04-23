import React from 'react';
import { Modal, Table, Typography, Space, Tag, Descriptions, Empty, Spin, Button } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSalesReturn, usePurchaseReturn, useUpdateSalesReturnStatus, useUpdatePurchaseReturnStatus } from '../hooks';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag } from '@/components/common';

const { Text } = Typography;

interface Props {
  open: boolean;
  returnId?: string;
  type: 'sales' | 'purchase';
  onClose: () => void;
}

const nextStatusOptions: Record<string, string[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['RECEIVING', 'SHIPPING', 'CANCELLED'],
  RECEIVING: ['COMPLETED', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
};

const ReturnDetailModal: React.FC<Props> = ({ open, returnId, type, onClose }) => {
  const { t } = useTranslation();
  const salesQuery = useSalesReturn(type === 'sales' ? returnId : undefined);
  const purchaseQuery = usePurchaseReturn(type === 'purchase' ? returnId : undefined);
  const updateSalesStatus = useUpdateSalesReturnStatus();
  const updatePurchaseStatus = useUpdatePurchaseReturnStatus();

  const query = type === 'sales' ? salesQuery : purchaseQuery;
  const detail = query.data?.data;

  const handleStatusChange = async (status: string) => {
    if (!returnId) return;
    if (type === 'sales') {
      await updateSalesStatus.mutateAsync({ id: returnId, status });
    } else {
      await updatePurchaseStatus.mutateAsync({ id: returnId, status });
    }
    query.refetch();
  };

  const allowedNext = detail ? (nextStatusOptions[detail.status] || []) : [];
  // For sales returns show RECEIVING, for purchase show SHIPPING
  const filteredNext = allowedNext.map((s) => {
    if (type === 'sales' && s === 'SHIPPING') return null;
    if (type === 'purchase' && s === 'RECEIVING') return null;
    return s;
  }).filter(Boolean) as string[];

  const entityName = type === 'sales'
    ? (detail?.customer?.company_name || detail?.customer?.contact_name || '')
    : (detail?.supplier?.company_name || '');

  const orderCode = type === 'sales'
    ? detail?.sales_order?.order_code
    : detail?.purchase_order?.order_code;

  return (
    <Modal
      open={open}
      title={`${t('return.detail')} - ${detail?.return_code || ''}`}
      footer={null}
      width={Math.min(window.innerWidth * 0.95, 750)}
      onCancel={onClose}
    >
      {query.isLoading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
      {!query.isLoading && !detail && <Empty />}
      {detail && (
        <>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t('return.returnCode')}><Text strong>{detail.return_code}</Text></Descriptions.Item>
            <Descriptions.Item label={t('product.status')}><StatusTag status={detail.status} type="return" /></Descriptions.Item>
            <Descriptions.Item label={type === 'sales' ? t('customer.name') : t('supplier.name')}>{entityName}</Descriptions.Item>
            <Descriptions.Item label={t('order.orderCode')}>{orderCode}</Descriptions.Item>
            <Descriptions.Item label={t('return.returnDate')}>{formatDate(detail.return_date)}</Descriptions.Item>
            <Descriptions.Item label={t('return.totalAmount')}><Text strong style={{ color: '#cf1322' }}>{formatVND(detail.total_amount)}</Text></Descriptions.Item>
            {detail.reason && <Descriptions.Item label={t('return.reason')} span={2}>{detail.reason}</Descriptions.Item>}
            {detail.notes && <Descriptions.Item label={t('return.notes')} span={2}>{detail.notes}</Descriptions.Item>}
          </Descriptions>

          {/* Status change */}
          {filteredNext.length > 0 && (
            <Space style={{ marginBottom: 16 }}>
              <Text type="secondary">{t('common.changeStatus')}:</Text>
              {filteredNext.map((s) => (
                <Button
                  key={s}
                  size="small"
                  type={s === 'COMPLETED' ? 'primary' : s === 'REJECTED' || s === 'CANCELLED' ? 'default' : 'default'}
                  danger={s === 'REJECTED' || s === 'CANCELLED'}
                  onClick={() => {
                    Modal.confirm({
                      title: t('order.confirmStatusChange'),
                      icon: <ExclamationCircleOutlined />,
                      content: `${detail.return_code}: ${t(`returnStatusLabels.${detail.status}`)} → ${t(`returnStatusLabels.${s}`)}`,
                      okText: t('common.confirm'),
                      cancelText: t('common.cancel'),
                      okButtonProps: { danger: s === 'REJECTED' || s === 'CANCELLED' },
                      onOk: () => handleStatusChange(s),
                    });
                  }}
                  loading={updateSalesStatus.isPending || updatePurchaseStatus.isPending}
                >
                  {t(`returnStatusLabels.${s}`)}
                </Button>
              ))}
            </Space>
          )}

          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('return.returnItems')}</Text>
          <Table
            size="small"
            dataSource={detail.items || []}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'STT', key: 'stt', width: 40, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
              {
                title: t('product.name'), key: 'name',
                render: (_: any, item: any) => (
                  <div>
                    <Text>{item.product?.name}</Text>
                    <br />
                    <Space size={4}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.product?.sku}</Text>
                      {item.product?.material && <Tag style={{ fontSize: 10, padding: '0 4px', borderRadius: 4, margin: 0 }}>{item.product.material}</Tag>}
                    </Space>
                  </div>
                ),
              },
              { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 110, align: 'right' as const, render: (v: number) => formatVND(v) },
              { title: 'SL', dataIndex: 'quantity', key: 'qty', width: 60, align: 'right' as const },
              { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{formatVND(v)}</Text> },
              { title: t('return.itemReason'), dataIndex: 'reason', key: 'reason', render: (v: string) => v || '-' },
            ]}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4} align="right"><Text strong>{t('order.orderTotal')}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><Text strong style={{ color: '#cf1322' }}>{formatVND(detail.total_amount)}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
              </Table.Summary.Row>
            )}
          />
        </>
      )}
    </Modal>
  );
};

export default ReturnDetailModal;
