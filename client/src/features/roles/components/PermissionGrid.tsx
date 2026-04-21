import React, { useMemo, useState } from 'react';
import { Input, Empty, Switch, Tag, Typography, Tooltip, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Permission } from '../types';
import { getModuleIcon, getActionVisual } from '../constants';

const { Text } = Typography;

interface Props {
  permissions: Permission[];
  checkedIds: Set<string>;
  readOnly?: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onToggleGroup: (ids: string[], checked: boolean) => void;
}

type Bucket = 'read' | 'create' | 'update' | 'delete' | 'other';
const CORE_BUCKETS: Bucket[] = ['read', 'create', 'update', 'delete'];

interface ModuleRow {
  module: string;
  moduleLabel: string;
  core: Record<Bucket, Permission | null>;
  others: Permission[];
  all: Permission[];
}

function translateModule(t: (k: string) => string, module: string): string {
  const key = `role.modules.${module}`;
  const v = t(key);
  if (v !== key) return v;
  const fb = t(`auditLog.models.${module}`);
  if (fb !== `auditLog.models.${module}`) return fb;
  return module;
}

function translateAction(t: (k: string) => string, action: string): string {
  const key = `role.actionLabels.${action}`;
  const v = t(key);
  if (v !== key) return v;
  return action;
}

function bucketFor(action: string): Bucket {
  if (action === 'read') return 'read';
  if (action === 'create') return 'create';
  if (action === 'update') return 'update';
  if (action === 'delete') return 'delete';
  return 'other';
}

const PermissionGrid: React.FC<Props> = ({ permissions, checkedIds, readOnly, onToggle, onToggleGroup }) => {
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

  const rows: ModuleRow[] = useMemo(() => {
    const byModule = new Map<string, Permission[]>();
    for (const p of filtered) {
      if (!byModule.has(p.module)) byModule.set(p.module, []);
      byModule.get(p.module)!.push(p);
    }
    return Array.from(byModule.entries())
      .map(([module, list]) => {
        const core: Record<Bucket, Permission | null> = { read: null, create: null, update: null, delete: null, other: null };
        const others: Permission[] = [];
        for (const p of list) {
          const b = bucketFor(p.action);
          if (b === 'other') others.push(p);
          else if (!core[b]) core[b] = p;
          else others.push(p);
        }
        return {
          module,
          moduleLabel: translateModule(t, module),
          core,
          others,
          all: list,
        };
      })
      .sort((a, b) => a.moduleLabel.localeCompare(b.moduleLabel));
  }, [filtered, t]);

  const renderCell = (p: Permission | null) => {
    if (!p) return <Text type="secondary" style={{ fontSize: 15 }}>—</Text>;
    const checked = checkedIds.has(p.id);
    const sw = (
      <Switch
        checked={checked}
        disabled={readOnly}
        onChange={(v) => onToggle(p.id, v)}
        size="small"
      />
    );
    return p.description ? <Tooltip title={p.description}>{sw}</Tooltip> : sw;
  };

  const renderOtherCell = (row: ModuleRow) => {
    if (row.others.length === 0) return <Text type="secondary" style={{ fontSize: 15 }}>—</Text>;
    return (
      <Space wrap size={[8, 6]}>
        {row.others.map((p) => {
          const vis = getActionVisual(p.action);
          const checked = checkedIds.has(p.id);
          const label = translateAction(t, p.action);
          const tooltip = p.description ? `${label} — ${p.description}` : label;
          return (
            <Tooltip key={p.id} title={tooltip}>
              <Tag
                color={checked ? vis.color : undefined}
                onClick={readOnly ? undefined : () => onToggle(p.id, !checked)}
                style={{
                  cursor: readOnly ? 'default' : 'pointer',
                  borderRadius: 999,
                  padding: '2px 12px',
                  fontWeight: 500,
                  opacity: checked ? 1 : 0.45,
                  border: checked ? 'none' : `1px solid ${vis.color}55`,
                  color: checked ? '#fff' : vis.color,
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                {checked ? '✓ ' : ''}{label}
              </Tag>
            </Tooltip>
          );
        })}
      </Space>
    );
  };

  const rowAllChecked = (row: ModuleRow) => row.all.every((p) => checkedIds.has(p.id));
  const rowAnyChecked = (row: ModuleRow) => row.all.some((p) => checkedIds.has(p.id));

  const toggleRow = (row: ModuleRow) => {
    const all = rowAllChecked(row);
    onToggleGroup(row.all.map((p) => p.id), !all);
  };

  return (
    <div>
      <Input
        allowClear
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        placeholder={t('role.search.placeholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ borderRadius: 8, marginBottom: 12 }}
      />

      {rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Empty description={<Text type="secondary">{t('role.search.noMatch')}</Text>} />
        </div>
      ) : (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 1.6fr) 72px 72px 72px 72px minmax(160px, 2fr) 56px',
            alignItems: 'center',
            padding: '12px 14px',
            background: 'linear-gradient(to bottom, #fafafa, #f5f5f5)',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 600,
            fontSize: 12,
            color: '#595959',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}>
            <span>{t('role.gridHeader.module')}</span>
            <span style={{ textAlign: 'center', color: getActionVisual('read').color }}>{t('role.gridHeader.view')}</span>
            <span style={{ textAlign: 'center', color: getActionVisual('create').color }}>{t('role.gridHeader.create')}</span>
            <span style={{ textAlign: 'center', color: getActionVisual('update').color }}>{t('role.gridHeader.update')}</span>
            <span style={{ textAlign: 'center', color: getActionVisual('delete').color }}>{t('role.gridHeader.delete')}</span>
            <span>{t('role.gridHeader.other')}</span>
            <span />
          </div>

          {/* Rows */}
          {rows.map((row, idx) => {
            const Icon = getModuleIcon(row.module);
            const allChecked = rowAllChecked(row);
            const anyChecked = rowAnyChecked(row);
            const bgColor = idx % 2 === 0 ? '#fff' : '#fafbfc';
            const selectedCount = row.all.filter((p) => checkedIds.has(p.id)).length;

            return (
              <div
                key={row.module}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(200px, 1.6fr) 72px 72px 72px 72px minmax(160px, 2fr) 56px',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: bgColor,
                  borderBottom: idx < rows.length - 1 ? '1px solid #f5f5f5' : 'none',
                  gap: 8,
                  minHeight: 56,
                }}
              >
                {/* Module cell */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${getActionVisual('manage').color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#595959', flexShrink: 0,
                  }}>
                    <Icon style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>{row.moduleLabel}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {selectedCount}/{row.all.length} {t('role.permissionShort')}
                    </Text>
                  </div>
                </div>

                {/* Core action cells */}
                {CORE_BUCKETS.map((b) => (
                  <div key={b} style={{ textAlign: 'center' }}>
                    {renderCell(row.core[b])}
                  </div>
                ))}

                {/* Others cell */}
                <div>{renderOtherCell(row)}</div>

                {/* Row toggle all */}
                <div style={{ textAlign: 'center' }}>
                  <Tooltip title={allChecked ? t('role.deselectAll') : t('role.selectAll')}>
                    <Switch
                      size="small"
                      checked={allChecked}
                      disabled={readOnly}
                      onChange={() => toggleRow(row)}
                      style={anyChecked && !allChecked ? { background: '#fa8c16' } : undefined}
                    />
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PermissionGrid;
