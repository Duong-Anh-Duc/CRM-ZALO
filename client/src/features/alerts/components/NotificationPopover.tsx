import React from 'react';
import { Popover, Badge, Button, Empty, Spin, Typography, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  BellOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  MoreOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import {
  useAlerts,
  useUnreadAlertCount,
  useMarkAlertRead,
  useMarkAllAlertsRead,
  useDeleteAlert,
} from '../hooks';
import type { Alert } from '@/types';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface IconCfg {
  color: string;
  icon: React.ReactNode;
}

const iconConfig: Record<Alert['type'], IconCfg> = {
  WARNING: { color: '#fa8c16', icon: <WarningOutlined /> },
  URGENT: { color: '#fa541c', icon: <ExclamationCircleOutlined /> },
  CRITICAL: { color: '#cf1322', icon: <ExclamationCircleOutlined /> },
  ESCALATION: { color: '#cf1322', icon: <ClockCircleOutlined /> },
};

interface AlertRowProps {
  alert: Alert;
  onClick: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const AlertRow: React.FC<AlertRowProps> = ({ alert, onClick, onMarkRead, onDelete }) => {
  const { t } = useTranslation();
  const cfg = iconConfig[alert.type] || iconConfig.WARNING;
  const isUnread = !alert.is_read;
  const [hovered, setHovered] = React.useState(false);

  const menuItems: MenuProps['items'] = [
    !alert.is_read && {
      key: 'mark-read',
      icon: <CheckOutlined />,
      label: t('alert.menuMarkRead'),
      onClick: () => onMarkRead(alert.id),
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: t('alert.menuDelete'),
      danger: true,
      onClick: () => onDelete(alert.id),
    },
  ].filter(Boolean) as MenuProps['items'];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 16px',
        cursor: 'pointer',
        background: hovered ? '#f2f2f2' : 'transparent',
        transition: 'background 0.15s',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 32,
          color: cfg.color,
          fontSize: 22,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 2,
        }}
      >
        {cfg.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 14,
            display: 'block',
            color: '#050505',
            fontWeight: isUnread ? 600 : 400,
            lineHeight: 1.4,
          }}
          ellipsis={{ tooltip: alert.title }}
        >
          {alert.title}
        </Text>
        <Text
          type="secondary"
          style={{
            fontSize: 13,
            color: '#65676b',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
            marginTop: 2,
          }}
        >
          {alert.message}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: isUnread ? '#1877f2' : '#65676b',
            fontWeight: isUnread ? 600 : 400,
            display: 'block',
            marginTop: 4,
          }}
        >
          {dayjs(alert.created_at).fromNow()}
        </Text>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'center',
        }}
      >
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            shape="circle"
            icon={<MoreOutlined style={{ fontSize: 18 }} />}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: hovered ? '#fff' : 'transparent',
              border: hovered ? '1px solid #ddd' : 'none',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
          />
        </Dropdown>
        {isUnread && (
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#1877f2',
              flexShrink: 0,
            }}
          />
        )}
      </div>
    </div>
  );
};

interface Props {
  children?: React.ReactNode;
}

const NotificationPopover: React.FC<Props> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<'all' | 'unread'>('all');
  const { data: alertsData, isLoading } = useAlerts({ limit: 30 });
  const alerts = (alertsData?.data ?? []) as Alert[];
  const { data: unreadRawData } = useUnreadAlertCount();
  const unreadCount = (unreadRawData?.data as { count: number } | undefined)?.count ?? 0;
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();
  const deleteAlert = useDeleteAlert();

  dayjs.locale(i18n.language === 'en' ? 'en' : 'vi');

  const filtered = tab === 'unread' ? alerts.filter((a) => !a.is_read) : alerts;

  // Group by date: Hôm nay / Trước đó
  const today = dayjs().startOf('day');
  const todayList = filtered.filter((a) => dayjs(a.created_at).isAfter(today));
  const earlierList = filtered.filter((a) => !dayjs(a.created_at).isAfter(today));

  const handleClose = () => setOpen(false);

  const handleAlertClick = (alert: Alert) => {
    if (!alert.is_read) markRead.mutate(alert.id);
    const target = alert.purchase_order_id
      ? `/purchase-orders/${alert.purchase_order_id}`
      : null;
    if (target) {
      navigate(target);
      handleClose();
    }
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: active ? '#e7f3ff' : 'transparent',
    color: active ? '#1877f2' : '#65676b',
    transition: 'background 0.15s',
  });

  const renderSection = (title: string, items: Alert[], showSeeAll?: boolean) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 16px 4px',
          }}
        >
          <Text strong style={{ fontSize: 16, color: '#050505' }}>
            {title}
          </Text>
          {showSeeAll && (
            <Text
              onClick={() => {
                navigate('/alerts');
                handleClose();
              }}
              style={{
                fontSize: 13,
                color: '#1877f2',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('alert.viewAll')}
            </Text>
          )}
        </div>
        {items.map((alert) => (
          <AlertRow
            key={alert.id}
            alert={alert}
            onClick={() => handleAlertClick(alert)}
            onMarkRead={(id) => markRead.mutate(id)}
            onDelete={(id) => deleteAlert.mutate(id)}
          />
        ))}
      </div>
    );
  };

  const content = (
    <div style={{ width: 380, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text strong style={{ fontSize: 22, color: '#050505' }}>
            {t('alert.title')}
          </Text>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'mark-all',
                  icon: <CheckOutlined />,
                  label: t('alert.menuMarkAllRead'),
                  disabled: unreadCount === 0,
                  onClick: () => markAllRead.mutate(),
                },
              ],
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              shape="circle"
              icon={<MoreOutlined style={{ fontSize: 18 }} />}
            />
          </Dropdown>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => setTab('all')} style={tabBtnStyle(tab === 'all')}>
            {t('alert.tabAll')}
          </button>
          <button
            type="button"
            onClick={() => setTab('unread')}
            style={tabBtnStyle(tab === 'unread')}
          >
            {t('alert.tabUnread')}
            {unreadCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: tab === 'unread' ? '#1877f2' : '#65676b',
                }}
              >
                ({unreadCount})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 480 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            description={tab === 'unread' ? t('alert.noUnread') : t('alert.noAlerts')}
            style={{ padding: 40 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <>
            {renderSection(t('alert.today'), todayList)}
            {renderSection(t('alert.earlier'), earlierList, todayList.length > 0)}
          </>
        )}
      </div>

      {/* Footer button — FB style gray full-width */}
      {filtered.length > 0 && (
        <div style={{ padding: '8px 12px 12px' }}>
          <Button
            block
            onClick={() => {
              navigate('/alerts');
              handleClose();
            }}
            style={{
              background: '#e4e6eb',
              border: 'none',
              fontWeight: 600,
              color: '#050505',
              height: 36,
              borderRadius: 8,
            }}
          >
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
      open={open}
      onOpenChange={setOpen}
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
