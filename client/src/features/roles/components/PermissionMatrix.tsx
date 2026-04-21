import React, { useMemo, useState } from 'react';
import { Input, Empty, Space, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Permission } from '../types';
import PermissionGroupCard from './PermissionGroupCard';

const { Text } = Typography;

interface PermissionMatrixProps {
  permissions: Permission[];
  checkedIds: Set<string>;
  readOnly?: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onToggleGroup: (ids: string[], checked: boolean) => void;
}

function translateModule(t: (k: string) => string, module: string): string {
  const key = `role.modules.${module}`;
  const val = t(key);
  if (val !== key) return val;
  const fallbackKey = `auditLog.models.${module}`;
  const fallback = t(fallbackKey);
  if (fallback !== fallbackKey) return fallback;
  return module;
}

const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  permissions,
  checkedIds,
  readOnly,
  onToggle,
  onToggleGroup,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredPermissions = useMemo(() => {
    if (!search.trim()) return permissions;
    const q = search.toLowerCase();
    return permissions.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        p.action.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        translateModule(t, p.module).toLowerCase().includes(q),
    );
  }, [permissions, search, t]);

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of filteredPermissions) {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries())
      .map(([module, list]) => ({
        module,
        label: translateModule(t, module),
        permissions: list.sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredPermissions, t]);

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
      {groups.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Empty
            description={
              <Text type="secondary">{t('role.search.noMatch')}</Text>
            }
          />
        </div>
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {groups.map((g) => (
            <PermissionGroupCard
              key={g.module}
              module={g.module}
              moduleLabel={g.label}
              permissions={g.permissions}
              checkedIds={checkedIds}
              readOnly={readOnly}
              onToggle={onToggle}
              onToggleGroup={onToggleGroup}
            />
          ))}
        </Space>
      )}
    </div>
  );
};

export default PermissionMatrix;
