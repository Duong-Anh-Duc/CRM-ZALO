import React, { useState } from 'react';
import { Table, Tag, Button, Empty, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { formatVND } from '@/utils/format';
import { useEmployeeProfiles } from '../hooks';
import { usePermission } from '@/contexts/AbilityContext';
import EmployeeProfileFormModal from './EmployeeProfileFormModal';

const EmployeeProfilesTab: React.FC = () => {
  const { t } = useTranslation();
  const canManageEmployees = usePermission('payroll.manage_employees');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: employeesData, isLoading, refetch } = useEmployeeProfiles({ page, limit: pageSize });
  const employees = (employeesData as any)?.data ?? [];
  const total = (employeesData as any)?.meta?.total ?? 0;
  const existingUserIds = employees.map((e: any) => e.user_id ?? e.user?.id).filter(Boolean);

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('payroll.employeeName') || t('user.fullName'), key: 'name', ellipsis: true, render: (_: any, r: any) => r.user?.full_name ?? '' },
    { title: t('auth.email'), key: 'email', width: 180, responsive: ['md'] as any, render: (_: any, r: any) => r.user?.email ?? '' },
    { title: t('payroll.baseSalary'), dataIndex: 'base_salary', key: 'salary', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    {
      title: t('payroll.mealAllowance'), key: 'allowances', width: 130, align: 'right' as const, responsive: ['lg'] as any,
      render: (_: any, r: any) => formatVND((r.meal_allowance || 0) + (r.phone_allowance || 0) + (r.fuel_allowance || 0)),
    },
    { title: t('payroll.dependents'), dataIndex: 'dependents', key: 'deps', width: 60, align: 'center' as const },
    {
      title: t('payroll.employmentStatus'), key: 'status', width: 110,
      render: (_: any, r: any) => (
        <Tag color={r.employment_status === 'ACTIVE' ? 'green' : r.employment_status === 'PROBATION' ? 'orange' : 'default'} style={{ borderRadius: 8 }}>
          {t(`payroll.${r.employment_status.toLowerCase()}`)}
        </Tag>
      ),
    },
    {
      title: t('common.actions'), key: 'actions', width: 70, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, rec: any) => (
        canManageEmployees ? (
          <Tooltip title={t('payroll.editProfile')}>
            <Button type="text" size="small" icon={<EditOutlined />} style={{ color: '#faad14' }} onClick={() => { setEditingEmployee(rec); setModalOpen(true); }} />
          </Tooltip>
        ) : null
      ),
    },
  ];

  return (
    <>
      {canManageEmployees && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => { setEditingEmployee(null); setModalOpen(true); }}>
            {t('payroll.addProfile')}
          </Button>
        </div>
      )}

      <Table
        dataSource={employees} columns={columns} rowKey="id" size="small" loading={isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        locale={{ emptyText: <Empty description={t('common.noData')} /> }}
      />

      <EmployeeProfileFormModal
        open={modalOpen} editingEmployee={editingEmployee} existingUserIds={existingUserIds}
        onCancel={() => { setModalOpen(false); setEditingEmployee(null); }}
        onSuccess={() => { setModalOpen(false); setEditingEmployee(null); refetch(); }}
      />
    </>
  );
};

export default EmployeeProfilesTab;
