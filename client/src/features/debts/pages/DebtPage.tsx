import React from 'react';
import { Tabs, Card } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';
import ReceivableListPage from './ReceivableListPage';
import PayableListPage from './PayableListPage';

const DebtPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <Card style={{ borderRadius: 12 }}>
        <PageHeader title={t('debt.title')} />
        <Tabs
          defaultActiveKey="receivables"
          items={[
            {
              key: 'receivables',
              label: <span><ArrowDownOutlined style={{ color: '#1890ff' }} /> {t('debt.receivables')}</span>,
              children: <ReceivableListPage />,
            },
            {
              key: 'payables',
              label: <span><ArrowUpOutlined style={{ color: '#fa541c' }} /> {t('debt.payables')}</span>,
              children: <PayableListPage />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default DebtPage;
