import React from 'react';
import { Card, Row, Col, Statistic, Skeleton } from 'antd';
import {
  SafetyOutlined,
  KeyOutlined,
  UserOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { CARD_RADIUS } from '../constants';

interface RoleStatsProps {
  totalRoles: number;
  totalPermissions: number;
  totalUsers: number;
  customRoles: number;
  loading?: boolean;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, loading }) => (
  <Card
    style={{ borderRadius: CARD_RADIUS, border: '1px solid #f0f0f0' }}
    styles={{ body: { padding: 16 } }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: `${color}14`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 1, width: '60%' }} title={{ width: '80%' }} />
        ) : (
          <Statistic
            title={label}
            value={value}
            valueStyle={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}
          />
        )}
      </div>
    </div>
  </Card>
);

const RoleStats: React.FC<RoleStatsProps> = ({
  totalRoles,
  totalPermissions,
  totalUsers,
  customRoles,
  loading,
}) => {
  const { t } = useTranslation();

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} sm={12} lg={6}>
        <StatCard
          icon={<SafetyOutlined />}
          label={t('role.overview.totalRoles')}
          value={totalRoles}
          color="#1677ff"
          loading={loading}
        />
      </Col>
      <Col xs={12} sm={12} lg={6}>
        <StatCard
          icon={<KeyOutlined />}
          label={t('role.overview.totalPermissions')}
          value={totalPermissions}
          color="#722ed1"
          loading={loading}
        />
      </Col>
      <Col xs={12} sm={12} lg={6}>
        <StatCard
          icon={<UserOutlined />}
          label={t('role.overview.totalUsers')}
          value={totalUsers}
          color="#52c41a"
          loading={loading}
        />
      </Col>
      <Col xs={12} sm={12} lg={6}>
        <StatCard
          icon={<StarOutlined />}
          label={t('role.overview.customRoles')}
          value={customRoles}
          color="#fa8c16"
          loading={loading}
        />
      </Col>
    </Row>
  );
};

export default RoleStats;
