import React from 'react';
import { Popover, List, Tag, Badge, Button, Empty, Spin, Typography, Space } from 'antd';
import {
  BellOutlined, CheckOutlined, WarningOutlined,
  ExclamationCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { useAlerts, useUnreadAlertCount, useMarkAlertRead } from '../hooks';
import type { Alert } from '@/types';

dayjs.extend(relativeTime);

const { Text } = Typography;

const typeConfig: Record<Alert['type'], { color: string; icon: React.ReactNode }> = {
  WARNING: { color: 'gold', icon: <WarningOutlined /> },
  URGENT: { color: 'orange', icon: <ExclamationCircleOutlined /> },
  CRITICAL: { color: 'red', icon: <ExclamationCircleOutlined /> },
  ESCALATION: { color: 'purple', icon: <ClockCircleOutlined /> },
};

const borderColors: Record<string, string> = {
  gold: '#faad14', orange: '#fa8c16', red: '#f5222d', purple: '#722ed1',
};

interface Props {
  children?: React.ReactNode;
}

const NotificationPopover: React.FC<Props> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: alertsData, isLoading } = useAlerts({ limit: 20 });
  const alerts = (alertsData?.data ?? []) as Alert[];
  const { data: unreadRawData } = useUnreadAlertCount();
  const unreadCount = (unreadRawData?.data as { count: number } | undefined)?.count ?? 0;
  const markRead = useMarkAlertRead();

  dayjs.locale(i18n.language === 'en' ? 'en' : 'vi');

  const content = (
    <div style={{ width: 380, maxHeight: 480, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 16 }}>{t('alert.title')}</Text>
        {unreadCount > 0 && (
          <Badge count={unreadCount} style={{ backgroundColor: '#f5222d' }} />
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : alerts.length === 0 ? (
          <Empty description={t('alert.noAlerts')} style={{ padding: 40 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={alerts}
            renderItem={(alert) => {
              const cfg = typeConfig[alert.type];
              return (
                <div
                  key={alert.id}
                  style={{
                    padding: '10px 16px',
                    margin: '4px 8px',
                    border: `1px solid ${borderColors[cfg.color] || '#d9d9d9'}`,
                    borderRadius: 8,
                    background: alert.is_read ? 'transparent' : '#fffbe6',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = alert.is_read ? 'transparent' : '#f6ffed'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Space size={4} style={{ marginBottom: 4 }}>
                        <Tag color={cfg.color} icon={cfg.icon} style={{ borderRadius: 6, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>
                          {t(`alert.type${alert.type.charAt(0) + alert.type.slice(1).toLowerCase()}`)}
                        </Tag>
                        {!alert.is_read && <Badge dot status="processing" />}
                      </Space>
                      <div>
                        <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>{alert.title}</Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }} ellipsis>{alert.message}</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                        {dayjs(alert.created_at).fromNow()}
                      </Text>
                    </div>
                    {!alert.is_read && (
                      <Button
                        type="text"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={(e) => { e.stopPropagation(); markRead.mutate(alert.id); }}
                        style={{ color: '#52c41a', flexShrink: 0, marginTop: 2 }}
                        title={t('alert.markRead')}
                      />
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
          <Button type="link" onClick={() => navigate('/alerts')} style={{ fontSize: 13 }}>
            {t('alert.viewAll')}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      overlayInnerStyle={{ padding: 0, borderRadius: 12, overflow: 'hidden' }}
    >
      {children || (
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: '#595959' }} />
        </Badge>
      )}
    </Popover>
  );
};

export default NotificationPopover;
