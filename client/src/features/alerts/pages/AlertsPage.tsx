import React, { useState } from 'react';
import { toast } from 'react-toastify';
import {
  Card, List, Tag, Badge, Button, Select, Space, Row, Col, DatePicker,
  Input, Spin, Empty, Typography,
} from 'antd';
import {
  BellOutlined, CheckOutlined, TruckOutlined, MessageOutlined,
  ClockCircleOutlined, WarningOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { useTranslation } from 'react-i18next';
import { useAlerts, useUnreadAlertCount, useMarkAlertRead, useAlertAction } from '../hooks';
import { Alert } from '@/types';
import { formatDateTime } from '@/utils/format';
import { PageHeader } from '@/components/common';
import { usePermission } from '@/contexts/AbilityContext';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Text } = Typography;
const { TextArea } = Input;

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const AlertsPage: React.FC = () => {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterRead, setFilterRead] = useState<string | undefined>();
  const [newDateId, setNewDateId] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const canManageAlerts = usePermission('alert.manage');

  const typeConfig: Record<Alert['type'], { color: string; label: string; icon: React.ReactNode }> = {
    WARNING: { color: 'gold', label: t('alert.typeWarning'), icon: <WarningOutlined /> },
    URGENT: { color: 'orange', label: t('alert.typeUrgent'), icon: <ExclamationCircleOutlined /> },
    CRITICAL: { color: 'red', label: t('alert.typeCritical'), icon: <ExclamationCircleOutlined /> },
    ESCALATION: { color: 'red', label: t('alert.typeEscalation'), icon: <ClockCircleOutlined /> },
  };

  const { data: alertsData, isLoading } = useAlerts({
    type: filterType || undefined,
    is_read: filterRead === 'read' ? true : filterRead === 'unread' ? false : undefined,
  });
  const alerts = (alertsData?.data ?? []) as Alert[];

  const { data: unreadRawData } = useUnreadAlertCount();
  const unreadData = unreadRawData?.data as { count: number } | undefined;

  const markReadMutation = useMarkAlertRead();
  const actionMutation = useAlertAction();

  const generateMessage = (alert: Alert): string => {
    if (alert.type === 'WARNING' || alert.type === 'URGENT') {
      return t('alert.messageTemplateWarning', { title: alert.title, message: alert.message });
    }
    return t('alert.messageTemplateDefault', { title: alert.title, message: alert.message });
  };

  const unreadCount = unreadData?.count ?? 0;

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ borderRadius: 12, marginBottom: 20 }}>
        <PageHeader
          title={
            <Space align="center">
              <span>{t('alert.title')}</span>
              <Badge count={unreadCount} overflowCount={99}>
                <BellOutlined style={{ fontSize: 22 }} />
              </Badge>
            </Space>
          }
          extra={
            <Space>
              <Select
                placeholder={t('alert.filterType')}
                allowClear
                value={filterType}
                onChange={setFilterType}
                style={{ width: 160, borderRadius: 8 }}
                options={[
                  { label: t('alert.typeWarning'), value: 'WARNING' },
                  { label: t('alert.typeUrgent'), value: 'URGENT' },
                  { label: t('alert.typeCritical'), value: 'CRITICAL' },
                  { label: t('alert.typeEscalation'), value: 'ESCALATION' },
                ]}
              />
              <Select
                placeholder={t('alert.filterStatus')}
                allowClear
                value={filterRead}
                onChange={setFilterRead}
                style={{ width: 140, borderRadius: 8 }}
                options={[
                  { label: t('alert.unread'), value: 'unread' },
                  { label: t('alert.read'), value: 'read' },
                ]}
              />
            </Space>
          }
        />
      </Card>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" tip={t('common.loading')} />
        </div>
      ) : !(alerts ?? []).length ? (
        <Empty description={t('alert.noAlerts')} style={{ marginTop: 60 }} />
      ) : (
        <List
          dataSource={alerts}
          renderItem={(alert) => {
            const cfg = typeConfig[alert.type];
            return (
              <Card
                key={alert.id}
                style={{
                  ...cardStyle,
                  marginBottom: 12,
                  border: '1px solid #f0f0f0',
                  background: alert.is_read ? '#fff' : '#f6faff',
                  opacity: alert.is_read ? 0.85 : 1,
                }}
                size="small"
              >
                <Row justify="space-between" align="top">
                  <Col flex="auto">
                    <Space style={{ marginBottom: 8 }}>
                      <Tag
                        color={cfg.color}
                        icon={cfg.icon}
                        style={{ borderRadius: 8 }}
                      >
                        {cfg.label}
                      </Tag>
                      {!alert.is_read && <Tag color="blue" style={{ borderRadius: 8 }}>{t('common.new')}</Tag>}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(alert.created_at)} ({dayjs(alert.created_at).fromNow()})
                      </Text>
                    </Space>
                    <div style={{ marginBottom: 4 }}>
                      <Text strong>{alert.title}</Text>
                    </div>
                    <Text type="secondary">{alert.message}</Text>
                    {alert.action_taken && (
                      <div style={{ marginTop: 6 }}>
                        <Tag color="green" style={{ borderRadius: 8 }}>{t('alert.actionTaken', { action: alert.action_taken })}</Tag>
                      </div>
                    )}
                  </Col>
                </Row>

                {/* Actions */}
                <Space wrap style={{ marginTop: 12 }}>
                  {!alert.is_read && (
                    <Button
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => markReadMutation.mutate(alert.id)}
                      loading={markReadMutation.isPending}
                      style={{ borderRadius: 8 }}
                    >
                      {t('alert.markRead')}
                    </Button>
                  )}
                  {!alert.action_taken && (
                    <>
                      <Button
                        size="small"
                        icon={<ClockCircleOutlined />}
                        onClick={() => setNewDateId(newDateId === alert.id ? null : alert.id)}
                        style={{ borderRadius: 8 }}
                      >
                        {t('alert.supplierConfirmLate')}
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<TruckOutlined />}
                        onClick={() => actionMutation.mutate({ id: alert.id, action: 'DELIVERED' }, { onSuccess: () => setNewDateId(null) })}
                        style={{ borderRadius: 8 }}
                      >
                        {t('alert.delivered')}
                      </Button>
                    </>
                  )}
                  {canManageAlerts && (
                    <Button
                      size="small"
                      icon={<MessageOutlined />}
                      onClick={() => setMessageId(messageId === alert.id ? null : alert.id)}
                      style={{ borderRadius: 8 }}
                    >
                      {t('alert.createMessage')}
                    </Button>
                  )}
                </Space>

                {/* New date picker for late confirmation */}
                {newDateId === alert.id && (
                  <div style={{ marginTop: 12 }}>
                    <Space>
                      <DatePicker
                        format="DD/MM/YYYY"
                        placeholder={t('alert.newDeliveryDate')}
                        style={{ borderRadius: 8 }}
                        onChange={(d) => {
                          if (d) {
                            actionMutation.mutate({
                              id: alert.id,
                              action: 'RESCHEDULE',
                              new_expected_date: d.format('YYYY-MM-DD'),
                            });
                          }
                        }}
                      />
                      <Button size="small" onClick={() => setNewDateId(null)} style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
                    </Space>
                  </div>
                )}

                {/* AI message template */}
                {messageId === alert.id && (
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      {t('alert.messageSuggestion')}
                    </Text>
                    <TextArea
                      rows={5}
                      defaultValue={generateMessage(alert)}
                      style={{ borderRadius: 8, marginBottom: 8 }}
                    />
                    <Space>
                      <Button type="primary" size="small" style={{ borderRadius: 8 }} onClick={() => {
                        toast.success(t('alert.sendViaZalo') + ' - OK');
                        setMessageId(null);
                      }}>{t('alert.sendViaZalo')}</Button>
                      <Button size="small" onClick={() => setMessageId(null)} style={{ borderRadius: 8 }}>{t('alert.close')}</Button>
                    </Space>
                  </div>
                )}
              </Card>
            );
          }}
        />
      )}
    </div>
  );
};

export default AlertsPage;
