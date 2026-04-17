import React from 'react';
import { Card, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';
import PayrollPeriodsTab from '../components/PayrollPeriodsTab';
import EmployeeProfilesTab from '../components/EmployeeProfilesTab';

const PayrollPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Card style={{ borderRadius: 12 }}>
      <PageHeader title={t('payroll.title')} />
      <Tabs
        items={[
          { key: 'periods', label: t('payroll.periods'), children: <PayrollPeriodsTab /> },
          { key: 'employees', label: t('payroll.employees'), children: <EmployeeProfilesTab /> },
        ]}
      />
    </Card>
  );
};

export default PayrollPage;
