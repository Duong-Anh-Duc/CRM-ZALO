import React, { useState } from 'react';
import { Table, Tag, Button, Space, Modal, Select, Popconfirm, Empty, Tooltip, Row, Col, Card, Statistic } from 'antd';
import { PlusOutlined, EyeOutlined, CalculatorOutlined, CheckOutlined, DollarOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { formatDate } from '@/utils/format';
import { usePayrollPeriods, useCreatePeriod, useCalculatePeriod, useApprovePeriod, usePayPeriod, useDeletePeriod } from '../hooks';
import { usePermission } from '@/contexts/AbilityContext';
import PayrollRecordsModal from './PayrollRecordsModal';

const statusColorMap: Record<string, string> = { DRAFT: 'default', CALCULATED: 'blue', APPROVED: 'cyan', PAID: 'green' };

const PayrollPeriodsTab: React.FC = () => {
  const { t } = useTranslation();
  const canManagePeriods = usePermission('payroll.manage_periods');
  const [createOpen, setCreateOpen] = useState(false);
  const [newYear, setNewYear] = useState(dayjs().year());
  const [newMonth, setNewMonth] = useState(dayjs().month() + 1);
  const [viewPeriod, setViewPeriod] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: periodsData, isLoading } = usePayrollPeriods({ page, limit: pageSize });
  const createPeriod = useCreatePeriod();
  const calculatePeriod = useCalculatePeriod();
  const approvePeriod = useApprovePeriod();
  const payPeriod = usePayPeriod();
  const deletePeriod = useDeletePeriod();

  const periods = (periodsData as any)?.data ?? [];
  const total = (periodsData as any)?.meta?.total ?? 0;

  // Summary from all periods (simple counts)
  const paidCount = periods.filter((p: any) => p.status === 'PAID').length;
  const totalEmployees = periods.length > 0 ? (periods[0]._count?.records || 0) : 0;

  const handleCreate = async () => {
    await createPeriod.mutateAsync({ year: newYear, month: newMonth });
    setCreateOpen(false);
  };

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('payroll.period'), key: 'period', width: 120, render: (_: any, r: any) => <span style={{ fontWeight: 600 }}>T{r.month}/{r.year}</span> },
    { title: t('payroll.employeeCount'), key: 'count', width: 80, align: 'center' as const, render: (_: any, r: any) => r._count?.records ?? '-' },
    {
      title: t('product.status'), key: 'status', width: 120,
      render: (_: any, r: any) => <Tag color={statusColorMap[r.status]} style={{ borderRadius: 8 }}>{t(`payroll.status${r.status.charAt(0) + r.status.slice(1).toLowerCase()}`)}</Tag>,
    },
    { title: t('common.date'), dataIndex: 'created_at', key: 'date', width: 110, render: formatDate },
    {
      title: t('common.actions'), key: 'actions', width: 140, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, rec: any) => (
        <Space size="small">
          {canManagePeriods && rec.status === 'DRAFT' && (
            <Tooltip title={t('payroll.calculate')}>
              <Button type="text" size="small" icon={<CalculatorOutlined />} style={{ color: '#1677ff' }}
                onClick={() => Modal.confirm({ title: t('payroll.calculate'), content: `T${rec.month}/${rec.year}`, okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: () => calculatePeriod.mutate(rec.id) })} />
            </Tooltip>
          )}
          {['CALCULATED', 'APPROVED', 'PAID'].includes(rec.status) && (
            <Tooltip title={t('payroll.viewRecords')}>
              <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => setViewPeriod(rec)} />
            </Tooltip>
          )}
          {canManagePeriods && rec.status === 'CALCULATED' && (
            <>
              <Tooltip title={t('payroll.calculate')}>
                <Button type="text" size="small" icon={<CalculatorOutlined />} style={{ color: '#722ed1' }}
                  onClick={() => Modal.confirm({ title: t('payroll.calculate'), content: `T${rec.month}/${rec.year}`, okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: () => calculatePeriod.mutate(rec.id) })} />
              </Tooltip>
              <Tooltip title={t('payroll.approve')}>
                <Button type="text" size="small" icon={<CheckOutlined />} style={{ color: '#13c2c2' }}
                  onClick={() => Modal.confirm({ title: t('payroll.approve'), content: `T${rec.month}/${rec.year}`, okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: () => approvePeriod.mutate(rec.id) })} />
              </Tooltip>
            </>
          )}
          {canManagePeriods && rec.status === 'APPROVED' && (
            <Popconfirm title={t('payroll.payConfirm')} onConfirm={() => payPeriod.mutate(rec.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
              <Tooltip title={t('payroll.pay')}>
                <Button type="text" size="small" icon={<DollarOutlined />} style={{ color: '#52c41a' }} />
              </Tooltip>
            </Popconfirm>
          )}
          {canManagePeriods && (rec.status === 'DRAFT' || rec.status === 'CALCULATED') && (
            <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => deletePeriod.mutate(rec.id)} okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }}>
              <Tooltip title={t('common.deleteRecord')}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Summary bar */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('payroll.periods')} value={total} valueStyle={{ fontSize: 18, color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('payroll.statusPaid')} value={paidCount} valueStyle={{ fontSize: 18, color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('payroll.employeeCount')} value={totalEmployees} prefix={<TeamOutlined />} valueStyle={{ fontSize: 18, color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      {canManagePeriods && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setCreateOpen(true)}>
            {t('payroll.createPeriod')}
          </Button>
        </div>
      )}

      <Table
        dataSource={periods} columns={columns} rowKey="id" size="small" loading={isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        locale={{ emptyText: <Empty description={t('common.noData')} /> }}
      />

      <Modal open={createOpen} title={t('payroll.createPeriod')} onCancel={() => setCreateOpen(false)} onOk={handleCreate} confirmLoading={createPeriod.isPending} width={Math.min(window.innerWidth * 0.95, 360)}>
        <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size="middle">
          <div><div style={{ marginBottom: 4 }}>{t('payroll.year')}</div><Select popupMatchSelectWidth={false} value={newYear} onChange={setNewYear} style={{ width: '100%' }} options={Array.from({ length: 5 }, (_, i) => ({ value: dayjs().year() - 2 + i, label: String(dayjs().year() - 2 + i) }))} /></div>
          <div><div style={{ marginBottom: 4 }}>{t('payroll.month')}</div><Select popupMatchSelectWidth={false} value={newMonth} onChange={setNewMonth} style={{ width: '100%' }} options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: t('payroll.monthLabel', { month: i + 1 }) }))} /></div>
        </Space>
      </Modal>

      <PayrollRecordsModal open={!!viewPeriod} period={viewPeriod} onCancel={() => setViewPeriod(null)} />
    </>
  );
};

export default PayrollPeriodsTab;
