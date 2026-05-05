import React, { useMemo, useState } from 'react';
import { Card, Table, Typography, Space, Input, Select, DatePicker, Tag, Button, Tooltip, Empty } from 'antd';
import { SearchOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { auditLogApi } from '../api';
import type { AuditLog, AuditLogFilters } from '../types';
import AuditLogDetailModal from '../components/AuditLogDetailModal';
import { formatDate } from '@/utils/format';
import { PageHeader } from '@/components/common';

const { Text } = Typography;

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  UPSERT: 'purple',
};

function pickRecordLabel(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const candidates = ['name', 'company_name', 'order_code', 'invoice_number', 'return_code', 'sku', 'email', 'code', 'title', 'reference'];
  for (const k of candidates) {
    const v = d[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

const AuditLogPage: React.FC = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, limit: 50 });
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const translateAction = (a: string) => {
    const k = `auditLog.actions.${a}`;
    const v = t(k);
    return v === k ? a : v;
  };
  const translateModel = (m: string) => {
    const k = `auditLog.models.${m}`;
    const v = t(k);
    return v === k ? m : v;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditLogApi.list(filters).then((r) => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: modelsData } = useQuery({ queryKey: ['audit-log-models'], queryFn: () => auditLogApi.models().then((r) => r.data) });
  const { data: usersData } = useQuery({ queryKey: ['audit-log-users'], queryFn: () => auditLogApi.users().then((r) => r.data) });

  const modelOptions = useMemo(
    () => (modelsData?.data || []).map((m: string) => ({ value: m, label: translateModel(m) })),
    [modelsData, t]
  );
  const userOptions = useMemo(
    () => (usersData?.data || []).map((u: { user_id: string; user_name: string; user_full_name: string | null }) => ({
      value: u.user_id,
      label: u.user_full_name || u.user_name || u.user_id,
    })),
    [usersData]
  );

  const logs: AuditLog[] = data?.data ?? [];
  const meta = data?.meta;

  const columns: any[] = [
    {
      title: 'STT', key: 'stt', width: 60, align: 'center' as const,
      render: (_: unknown, __: unknown, i: number) => ((filters.page || 1) - 1) * (filters.limit || 50) + i + 1,
    },
    {
      title: t('auditLog.time'), dataIndex: 'created_at', key: 'created_at', width: 160, responsive: ['md'] as any,
      render: (v: string) => (
        <Space direction="vertical" size={0}>
          <Text>{formatDate(v)}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format('HH:mm:ss')}</Text>
        </Space>
      ),
    },
    {
      title: t('auditLog.operator'), key: 'operator', width: 200, responsive: ['md'] as any,
      render: (_: unknown, rec: AuditLog) => rec.user_full_name
        ? <Space direction="vertical" size={0}>
            <Text strong>{rec.user_full_name}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{rec.user_name}</Text>
          </Space>
        : <Text type="secondary">{rec.user_name || '—'}</Text>,
    },
    {
      title: t('auditLog.action'), key: 'action', width: 130,
      render: (_: unknown, rec: AuditLog) => <Tag color={ACTION_COLORS[rec.action] || 'default'} style={{ borderRadius: 4 }}>{translateAction(rec.action)}</Tag>,
    },
    {
      title: t('auditLog.model'), key: 'model', ellipsis: true,
      render: (_: unknown, rec: AuditLog) => {
        const label = translateModel(rec.model_name);
        const recordLabel = pickRecordLabel(rec.new_data) || pickRecordLabel(rec.old_data);
        return (
          <Space size={6}>
            <Text strong>{label}</Text>
            {recordLabel && <Text type="secondary">— {recordLabel}</Text>}
          </Space>
        );
      },
    },
    {
      title: '', key: 'actions', width: 50, align: 'center' as const, fixed: 'right' as const,
      render: (_: unknown, rec: AuditLog) => (
        <Tooltip title={t('common.viewDetail')}>
          <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => setSelected(rec)} />
        </Tooltip>
      ),
    },
  ];

  const updateFilter = (patch: Partial<AuditLogFilters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));

  return (
    <div>
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <PageHeader title={t('auditLog.menuTitle')} />
        <Space size={8} wrap style={{ width: '100%' }}>
          <Input
            placeholder={t('auditLog.searchPlaceholder')}
            prefix={<SearchOutlined />}
            allowClear
            style={{ maxWidth: 240, flex: '1 1 180px', borderRadius: 8 }}
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value || undefined })}
          />
          <Select popupMatchSelectWidth={false}
            placeholder={t('auditLog.filterAction')}
            allowClear
            style={{ maxWidth: 160, flex: '1 1 120px', borderRadius: 8 }}
            value={filters.action}
            onChange={(v) => updateFilter({ action: v })}
            options={[
              { value: 'CREATE', label: translateAction('CREATE') },
              { value: 'UPDATE', label: translateAction('UPDATE') },
              { value: 'DELETE', label: translateAction('DELETE') },
              { value: 'UPSERT', label: translateAction('UPSERT') },
            ]}
          />
          <Select popupMatchSelectWidth={false}
            placeholder={t('auditLog.filterModel')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ maxWidth: 200, flex: '1 1 140px', borderRadius: 8 }}
            value={filters.model_name}
            onChange={(v) => updateFilter({ model_name: v })}
            options={modelOptions}
          />
          <Select popupMatchSelectWidth={false}
            placeholder={t('auditLog.filterUser')}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ maxWidth: 220, flex: '1 1 160px', borderRadius: 8 }}
            value={filters.user_id}
            onChange={(v) => updateFilter({ user_id: v })}
            options={userOptions}
          />
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            style={{ borderRadius: 8, maxWidth: 280, flex: '1 1 220px' }}
            placeholder={[t('common.fromDate'), t('common.toDate')]}
            onChange={(d) => updateFilter({
              from_date: d?.[0]?.format('YYYY-MM-DD'),
              to_date: d?.[1]?.format('YYYY-MM-DD'),
            })}
          />
          <Tooltip title={t('common.refresh')}>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ borderRadius: 8 }} />
          </Tooltip>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Table
          loading={isLoading}
          columns={columns}
          dataSource={logs}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: meta?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
            showTotal: (total) => t('auditLog.totalRecords', { count: total }),
            onChange: (page, limit) => setFilters((f) => ({ ...f, page, limit })),
          }}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
        />
      </Card>

      <AuditLogDetailModal log={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default AuditLogPage;
