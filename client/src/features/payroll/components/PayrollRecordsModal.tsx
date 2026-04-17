import React, { useState } from 'react';
import { Modal, Table, Empty, Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { formatVND } from '@/utils/format';
import { usePeriodRecords } from '../hooks';
import PayslipModal from './PayslipModal';

interface Props {
  open: boolean;
  period: any;
  onCancel: () => void;
}

const PayrollRecordsModal: React.FC<Props> = ({ open, period, onCancel }) => {
  const { t } = useTranslation();
  const { data: recordsData, isLoading } = usePeriodRecords(open ? period?.id : undefined);
  const records = (recordsData as any)?.data ?? [];

  const [payslipTarget, setPayslipTarget] = useState<{ empId: string; name: string } | null>(null);

  const periodLabel = period ? `T${period.month}/${period.year}` : '';

  const columns = [
    {
      title: t('common.stt'),
      key: 'stt',
      width: 50,
      align: 'center' as const,
      render: (_: unknown, __: unknown, i: number) => i + 1,
    },
    {
      title: t('payroll.employeeName'),
      key: 'name',
      render: (_: unknown, r: any) => r.employee?.user?.full_name ?? r.employee_name ?? '',
    },
    {
      title: t('payroll.grossSalary'),
      dataIndex: 'gross_salary',
      key: 'gross',
      align: 'right' as const,
      width: 150,
      render: (v: number) => formatVND(v),
    },
    {
      title: t('payroll.netSalaryLabel'),
      dataIndex: 'net_salary',
      key: 'net',
      align: 'right' as const,
      width: 150,
      render: (v: number) => formatVND(v),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: any) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setPayslipTarget({
            empId: r.employee_id ?? r.employee?.id,
            name: r.employee?.user?.full_name ?? r.employee_name ?? '',
          })}
          style={{ borderRadius: 8 }}
        >
          {t('payroll.payslip')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Modal
        open={open}
        title={`${t('payroll.periodRecords')} - ${periodLabel}`}
        onCancel={onCancel}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={false}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
        />
      </Modal>

      <PayslipModal
        open={!!payslipTarget}
        periodId={period?.id}
        employeeId={payslipTarget?.empId}
        periodLabel={periodLabel}
        onCancel={() => setPayslipTarget(null)}
      />
    </>
  );
};

export default PayrollRecordsModal;
