import React, { useMemo } from 'react';
import { Typography, Tag, Space } from 'antd';
import { SafetyOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Permission } from '../types';
import {
  getModuleIcon,
  getActionVisual,
  getRoleVisual,
  INNER_RADIUS,
} from '../constants';

const { Title, Text, Paragraph } = Typography;

interface AdminLockedStateProps {
  permissions: Permission[];
}

function translateModule(t: (k: string) => string, module: string): string {
  const key = `role.modules.${module}`;
  const val = t(key);
  if (val !== key) return val;
  return module;
}

const AdminLockedState: React.FC<AdminLockedStateProps> = ({ permissions }) => {
  const { t } = useTranslation();
  const visual = getRoleVisual('admin');

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
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
  }, [permissions, t]);

  return (
    <div>
      {/* Hero block */}
      <div
        style={{
          borderRadius: INNER_RADIUS,
          padding: '16px 20px',
          background: `${visual.solid}0a`,
          border: `1px solid ${visual.solid}22`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${visual.solid}14`,
            color: visual.solid,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          <SafetyOutlined />
        </div>
        <div style={{ flex: 1 }}>
          <Space size={8} style={{ marginBottom: 2 }}>
            <Title level={5} style={{ margin: 0 }}>
              {t('role.admin.heroTitle')}
            </Title>
            <Tag color="red" bordered={false} style={{ borderRadius: 6, margin: 0 }}>
              {t('role.admin.fullAccess')}
            </Tag>
          </Space>
          <Paragraph style={{ margin: 0, color: '#595959', fontSize: 13 }}>
            {t('role.admin.heroDescription')}
          </Paragraph>
        </div>
      </div>

      {/* Permission listing */}
      <div>
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
          {t('role.admin.listTitle', { count: permissions.length })}
        </Text>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {groups.map((g) => {
            const Icon = getModuleIcon(g.module);
            return (
              <div
                key={g.module}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: INNER_RADIUS,
                  padding: '12px 16px',
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'rgba(22, 119, 255, 0.1)',
                      color: '#1677ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    <Icon />
                  </div>
                  <Text strong style={{ fontSize: 13 }}>
                    {g.label}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {g.permissions.length}
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {g.permissions.map((p) => {
                    const av = getActionVisual(p.action);
                    return (
                      <Tag
                        key={p.id}
                        color={av.color}
                        icon={<CheckCircleFilled />}
                        style={{
                          borderRadius: 6,
                          margin: 0,
                          fontSize: 11,
                          border: 'none',
                          padding: '1px 8px',
                        }}
                      >
                        {p.action}
                      </Tag>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Space>
      </div>
    </div>
  );
};

export default AdminLockedState;
