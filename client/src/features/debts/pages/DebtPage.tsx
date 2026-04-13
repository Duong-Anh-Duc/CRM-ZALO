import React from 'react';
import { Tabs, Card, Row, Col, Statistic } from 'antd';
import { DollarOutlined, WarningOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useReceivableSummary, usePayableSummary } from '../hooks';
import { formatVND } from '@/utils/format';
import { PageHeader } from '@/components/common';
import ReceivableListPage from './ReceivableListPage';
import PayableListPage from './PayableListPage';
import type { DebtSummary } from '@/types';

const cardStyle: React.CSSProperties = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

// ── Overview Tab ──
const OverviewTab: React.FC = () => {
  const { t } = useTranslation();
  const recSummary = useReceivableSummary();
  const paySummary = usePayableSummary();

  const rec = recSummary.data?.data as DebtSummary | undefined;
  const pay = paySummary.data?.data as DebtSummary | undefined;
  const totalRec = rec?.total_receivable ?? 0;
  const totalPay = pay?.total_payable ?? 0;
  const net = totalRec - totalPay;

  return (
    <div>
      {/* Net position */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card style={cardStyle}>
            <Statistic
              title={t('debt.totalReceivable')}
              value={totalRec}
              formatter={(v) => formatVND(v as number)}
              prefix={<ArrowDownOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={cardStyle}>
            <Statistic
              title={t('debt.totalPayable')}
              value={totalPay}
              formatter={(v) => formatVND(v as number)}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#fa541c' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={cardStyle}>
            <Statistic
              title={t('debt.netPosition')}
              value={net}
              formatter={(v) => formatVND(v as number)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: net >= 0 ? '#52c41a' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card style={cardStyle} title={t('debt.receivables')}>
            <Row gutter={[16, 16]}>
              <Col xs={12}>
                <Statistic title={t('debt.overdue')} value={rec?.overdue ?? 0} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#cf1322', fontSize: 18 }} prefix={<WarningOutlined />} />
              </Col>
              <Col xs={12}>
                <Statistic title={t('debt.dueThisWeek')} value={rec?.due_this_week ?? 0} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#fa8c16', fontSize: 18 }} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card style={cardStyle} title={t('debt.payables')}>
            <Row gutter={[16, 16]}>
              <Col xs={12}>
                <Statistic title={t('debt.overdue')} value={pay?.overdue ?? 0} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#cf1322', fontSize: 18 }} prefix={<WarningOutlined />} />
              </Col>
              <Col xs={12}>
                <Statistic title={t('debt.dueThisWeek')} value={pay?.due_this_week ?? 0} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#fa8c16', fontSize: 18 }} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ── Main Debt Page with 3 Tabs ──
const DebtPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <Card style={{ borderRadius: 12 }}>
        <PageHeader title={t('debt.title')} />
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: <span><DollarOutlined /> {t('debt.overview')}</span>,
              children: <OverviewTab />,
            },
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
