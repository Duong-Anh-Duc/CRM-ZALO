import React from 'react';
import { Typography, Checkbox, Tag, Button, Progress } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Permission } from '../types';
import { getModuleIcon, getActionVisual, INNER_RADIUS } from '../constants';

const { Text } = Typography;

interface PermissionGroupCardProps {
  module: string;
  moduleLabel: string;
  permissions: Permission[];
  checkedIds: Set<string>;
  readOnly?: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onToggleGroup: (ids: string[], checked: boolean) => void;
}

const PermissionGroupCard: React.FC<PermissionGroupCardProps> = ({
  module,
  moduleLabel,
  permissions,
  checkedIds,
  readOnly,
  onToggle,
  onToggleGroup,
}) => {
  const { t } = useTranslation();
  const Icon = getModuleIcon(module);
  const total = permissions.length;
  const checkedInGroup = permissions.filter((p) => checkedIds.has(p.id)).length;
  const allSelected = checkedInGroup === total && total > 0;
  const pct = total > 0 ? Math.round((checkedInGroup / total) * 100) : 0;
  const progressColor =
    checkedInGroup === 0
      ? '#d9d9d9'
      : allSelected
        ? '#52c41a'
        : '#1677ff';

  return (
    <div
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: INNER_RADIUS,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {/* Group header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'linear-gradient(180deg, #fafbfc 0%, #f5f6f8 100%)',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'rgba(22, 119, 255, 0.1)',
            color: '#1677ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          <Icon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 14 }}>
              {moduleLabel}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {checkedInGroup}/{total} {t('role.selectedShort')}
            </Text>
          </div>
          <Progress
            percent={pct}
            showInfo={false}
            size="small"
            strokeColor={progressColor}
            style={{ margin: 0, lineHeight: 1 }}
          />
        </div>
        {!readOnly && (
          <Button
            type="link"
            size="small"
            onClick={() =>
              onToggleGroup(
                permissions.map((p) => p.id),
                !allSelected,
              )
            }
            style={{ flexShrink: 0, padding: 0 }}
          >
            {allSelected ? t('role.deselectAll') : t('role.selectAll')}
          </Button>
        )}
      </div>

      {/* Permission rows */}
      <div>
        {permissions.map((p, idx) => {
          const visual = getActionVisual(p.action);
          const ActionIcon = visual.icon;
          const checked = checkedIds.has(p.id);
          return (
            <div
              key={p.id}
              onClick={() => {
                if (!readOnly) onToggle(p.id, !checked);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                borderTop: idx === 0 ? 'none' : '1px solid #f5f5f5',
                cursor: readOnly ? 'default' : 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!readOnly) {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(22,119,255,0.04)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  idx % 2 === 0 ? '#fff' : '#fafbfc';
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 13 }}>
                    {p.description || `${p.action} ${p.subject}`}
                  </Text>
                </div>
                <Text
                  code
                  style={{
                    fontSize: 11,
                    background: 'rgba(0,0,0,0.03)',
                    color: '#8c8c8c',
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: 'none',
                  }}
                >
                  {p.key}
                </Text>
              </div>
              <Tag
                color={visual.color}
                style={{
                  borderRadius: 6,
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'lowercase',
                  border: 'none',
                  padding: '1px 8px',
                }}
                icon={ActionIcon ? <ActionIcon /> : undefined}
              >
                {p.action}
              </Tag>
              <Checkbox
                checked={checked}
                disabled={readOnly}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onToggle(p.id, e.target.checked)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PermissionGroupCard;
