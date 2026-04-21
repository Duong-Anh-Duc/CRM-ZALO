import React, { useMemo, useState } from 'react';
import { Input, Empty, Switch, Tag, Typography, Progress, Button, Space } from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  DownloadOutlined,
  LockOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  SyncOutlined,
  DollarOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Permission } from '../types';
import { getModuleIcon } from '../constants';

const { Text } = Typography;

interface Props {
  permissions: Permission[];
  checkedIds: Set<string>;
  readOnly?: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onToggleGroup: (ids: string[], checked: boolean) => void;
}

// Action icon (flat, monochrome) — styled by color via style prop
const ACTION_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  read: EyeOutlined,
  create: PlusOutlined,
  update: EditOutlined,
  delete: DeleteOutlined,
  approve: CheckCircleOutlined,
  manage: ControlOutlined,
  manage_status: SyncOutlined,
  manage_items: EditOutlined,
  manage_images: AppstoreOutlined,
  manage_categories: AppstoreOutlined,
  manage_config: SettingOutlined,
  manage_employees: AppstoreOutlined,
  manage_periods: AppstoreOutlined,
  manage_training: AppstoreOutlined,
  finalize: LockOutlined,
  cancel: CloseCircleOutlined,
  export: DownloadOutlined,
  record_payment: DollarOutlined,
  sync_messages: SyncOutlined,
};

const ACTION_COLORS: Record<string, string> = {
  read: '#1677ff',
  create: '#52c41a',
  update: '#fa8c16',
  delete: '#ff4d4f',
  approve: '#faad14',
  manage: '#722ed1',
  manage_status: '#722ed1',
  manage_items: '#722ed1',
  manage_images: '#722ed1',
  manage_categories: '#722ed1',
  manage_config: '#722ed1',
  manage_employees: '#722ed1',
  manage_periods: '#722ed1',
  manage_training: '#722ed1',
  finalize: '#13c2c2',
  cancel: '#8c8c8c',
  export: '#13c2c2',
  record_payment: '#52c41a',
  sync_messages: '#722ed1',
};

function translateModule(t: (k: string) => string, module: string): string {
  const v = t(`role.modules.${module}`);
  if (v !== `role.modules.${module}`) return v;
  const fb = t(`auditLog.models.${module}`);
  if (fb !== `auditLog.models.${module}`) return fb;
  return module;
}

function translateAction(t: (k: string) => string, action: string): string {
  const v = t(`role.actionLabels.${action}`);
  if (v !== `role.actionLabels.${action}`) return v;
  return action;
}

const PermissionBrowser: React.FC<Props> = ({ permissions, checkedIds, readOnly, onToggle, onToggleGroup }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return permissions;
    const q = search.toLowerCase();
    return permissions.filter((p) =>
      p.key.toLowerCase().includes(q) ||
      p.action.toLowerCase().includes(q) ||
      p.subject.toLowerCase().includes(q) ||
      p.module.toLowerCase().includes(q) ||
      translateModule(t, p.module).toLowerCase().includes(q) ||
      translateAction(t, p.action).toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q),
    );
  }, [permissions, search, t]);

  const groups = useMemo(() => {
    const byModule = new Map<string, Permission[]>();
    for (const p of filtered) {
      if (!byModule.has(p.module)) byModule.set(p.module, []);
      byModule.get(p.module)!.push(p);
    }
    return Array.from(byModule.entries())
      .map(([module, list]) => ({
        module,
        label: translateModule(t, module),
        permissions: list.sort((a, b) => {
          // Sort core actions first
          const order = ['read', 'create', 'update', 'delete', 'approve'];
          const ai = order.indexOf(a.action);
          const bi = order.indexOf(b.action);
          if (ai !== -1 || bi !== -1) {
            const aScore = ai === -1 ? 99 : ai;
            const bScore = bi === -1 ? 99 : bi;
            if (aScore !== bScore) return aScore - bScore;
          }
          return a.key.localeCompare(b.key);
        }),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, t]);

  if (groups.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty description={<Text type="secondary">{t('role.search.noMatch')}</Text>} />
      </div>
    );
  }

  return (
    <div>
      <Input
        allowClear
        size="large"
        prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
        placeholder={t('role.search.placeholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ borderRadius: 10, marginBottom: 16 }}
      />

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {groups.map((group) => {
          const ModuleIcon = getModuleIcon(group.module);
          const selected = group.permissions.filter((p) => checkedIds.has(p.id)).length;
          const total = group.permissions.length;
          const pct = total > 0 ? Math.round((selected / total) * 100) : 0;
          const allChecked = selected === total;
          const anyChecked = selected > 0;

          return (
            <div
              key={group.module}
              style={{
                background: '#fff',
                border: '1px solid #eceff3',
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'box-shadow 0.2s',
              }}
            >
              {/* Module header */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #f0f0f0',
                  background: anyChecked ? '#f6ffed' : '#fafbfc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <ModuleIcon style={{ fontSize: 20, color: anyChecked ? '#52c41a' : '#8c8c8c' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 14, display: 'block' }}>
                    {group.label}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {selected}/{total} {t('role.permissionShort')} · {pct}%
                  </Text>
                </div>
                <div style={{ width: 100, marginRight: 8 }}>
                  <Progress
                    percent={pct}
                    size="small"
                    showInfo={false}
                    strokeColor={allChecked ? '#52c41a' : anyChecked ? '#fa8c16' : '#d9d9d9'}
                    style={{ margin: 0 }}
                  />
                </div>
                {!readOnly && (
                  <Button
                    size="small"
                    type={allChecked ? 'default' : 'primary'}
                    ghost={allChecked}
                    onClick={() => onToggleGroup(group.permissions.map((p) => p.id), !allChecked)}
                    style={{ borderRadius: 8, minWidth: 96 }}
                  >
                    {allChecked ? t('role.deselectAll') : t('role.selectAll')}
                  </Button>
                )}
              </div>

              {/* Permission rows */}
              <div>
                {group.permissions.map((p, idx) => {
                  const checked = checkedIds.has(p.id);
                  const ActionIcon = ACTION_ICONS[p.action] || ControlOutlined;
                  const actionColor = ACTION_COLORS[p.action] || '#8c8c8c';
                  const actionLabel = translateAction(t, p.action);
                  const descriptionText = p.description || `${actionLabel} ${group.label.toLowerCase()}`;

                  return (
                    <div
                      key={p.id}
                      onClick={readOnly ? undefined : () => onToggle(p.id, !checked)}
                      style={{
                        padding: '14px 20px',
                        borderBottom: idx < group.permissions.length - 1 ? '1px solid #f5f5f5' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        cursor: readOnly ? 'default' : 'pointer',
                        transition: 'background 0.15s',
                        background: checked ? 'rgba(82, 196, 26, 0.02)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!readOnly) (e.currentTarget as HTMLDivElement).style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = checked ? 'rgba(82, 196, 26, 0.02)' : 'transparent';
                      }}
                    >
                      {/* Action icon circle */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: `${actionColor}14`,
                          color: actionColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        <ActionIcon />
                      </div>

                      {/* Description + action chip */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, display: 'block', fontWeight: 500 }}>
                          {descriptionText}
                        </Text>
                        <Tag
                          color={actionColor}
                          bordered={false}
                          style={{
                            fontSize: 10,
                            lineHeight: '18px',
                            padding: '0 8px',
                            borderRadius: 4,
                            margin: '2px 0 0 0',
                            color: actionColor,
                            background: `${actionColor}14`,
                          }}
                        >
                          {actionLabel}
                        </Tag>
                      </div>

                      {/* Switch */}
                      <Switch
                        checked={checked}
                        disabled={readOnly}
                        onChange={(v) => onToggle(p.id, v)}
                        onClick={(_, e) => e.stopPropagation()}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Space>
    </div>
  );
};

export default PermissionBrowser;
