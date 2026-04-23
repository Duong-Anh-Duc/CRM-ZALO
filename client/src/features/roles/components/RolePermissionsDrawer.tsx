import React, { useEffect, useMemo, useState } from 'react';
import {
  Drawer,
  Button,
  Space,
  Alert,
  Skeleton,
  Typography,
  Tag,
  Progress,
} from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Permission, Role } from '../types';
import PermissionBrowser from './PermissionBrowser';
import AdminLockedState from './AdminLockedState';
import { getRoleVisual } from '../constants';
import { translateRoleName, translateRoleDescription } from '../i18n';

const { Text, Title, Paragraph } = Typography;

interface Props {
  open: boolean;
  role: Role | undefined;
  permissions: Permission[];
  loading?: boolean;
  saving?: boolean;
  permissionsLoading?: boolean;
  isReadOnly: boolean;
  isAdminRole: boolean;
  isEditingOwnRole: boolean;
  onClose: () => void;
  onSave: (permissionIds: string[]) => void;
}

const RolePermissionsDrawer: React.FC<Props> = ({
  open,
  role,
  permissions,
  loading,
  saving,
  permissionsLoading,
  isReadOnly,
  isAdminRole,
  isEditingOwnRole,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (role) {
      setCheckedIds(new Set(role.permissions.map((p) => p.id)));
    } else {
      setCheckedIds(new Set());
    }
  }, [role]);

  const originalIds = useMemo(
    () => new Set((role?.permissions ?? []).map((p) => p.id)),
    [role],
  );
  const isDirty = useMemo(() => {
    if (!role) return false;
    if (originalIds.size !== checkedIds.size) return true;
    for (const id of originalIds) {
      if (!checkedIds.has(id)) return true;
    }
    return false;
  }, [originalIds, checkedIds, role]);

  const handleToggle = (id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleGroup = (ids: string[], checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const handleReset = () => {
    if (role) setCheckedIds(new Set(role.permissions.map((p) => p.id)));
  };

  const handleSave = () => {
    onSave(Array.from(checkedIds));
  };

  const visual = role ? getRoleVisual(role.slug) : null;
  const Icon = visual?.icon;
  const roleName = role ? translateRoleName(t, role) : '';
  const roleDescription = role ? translateRoleDescription(t, role) : null;

  const totalPermissions = permissions.length;
  const grantedCount = checkedIds.size;
  const pct =
    totalPermissions > 0 ? Math.round((grantedCount / totalPermissions) * 100) : 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={Math.min(window.innerWidth * 0.95, 720)}
      destroyOnClose
      styles={{
        body: { padding: 0 },
        header: { display: 'none' },
      }}
      footer={
        !isReadOnly && role ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isDirty
                ? t('role.sticky.unsavedChanges')
                : t('role.stats.granted', {
                    granted: grantedCount,
                    total: totalPermissions,
                  })}
            </Text>
            <Space>
              <Button
                onClick={isDirty ? handleReset : onClose}
                style={{ borderRadius: 8 }}
              >
                {isDirty ? t('common.cancel') : t('common.close')}
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={!isDirty}
                onClick={handleSave}
                style={{ borderRadius: 8 }}
              >
                {t('role.save')}
              </Button>
            </Space>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              icon={<CloseOutlined />}
              onClick={onClose}
              style={{ borderRadius: 8 }}
            >
              {t('common.close')}
            </Button>
          </div>
        )
      }
    >
      {role && visual && Icon ? (
        <>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f0f0f0',
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
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
                <Icon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Space size={8} wrap style={{ marginBottom: 4 }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {roleName}
                  </Title>
                  {role.is_system && (
                    <Tag color="blue" bordered={false} style={{ borderRadius: 6, margin: 0 }}>
                      {t('role.systemTag')}
                    </Tag>
                  )}
                </Space>
                {roleDescription && (
                  <Paragraph
                    type="secondary"
                    style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}
                    ellipsis={{ rows: 2, tooltip: roleDescription }}
                  >
                    {roleDescription}
                  </Paragraph>
                )}
              </div>
            </div>

            {!isAdminRole && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#595959' }}>
                    {t('role.stats.granted', {
                      granted: grantedCount,
                      total: totalPermissions,
                    })}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                    {pct}%
                  </Text>
                </div>
                <Progress
                  percent={pct}
                  showInfo={false}
                  size="small"
                  strokeColor={visual.solid}
                  trailColor="#f0f0f0"
                  style={{ margin: 0 }}
                />
              </div>
            )}
          </div>

          <div style={{ padding: 20 }}>
            {isEditingOwnRole && !isAdminRole && (
              <Alert
                type="warning"
                showIcon
                message={t('role.selfEditWarning')}
                style={{ borderRadius: 8, marginBottom: 12 }}
              />
            )}
            {isAdminRole ? (
              <AdminLockedState permissions={permissions} />
            ) : loading || permissionsLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <PermissionBrowser
                permissions={permissions}
                checkedIds={checkedIds}
                readOnly={isReadOnly}
                onToggle={handleToggle}
                onToggleGroup={handleToggleGroup}
              />
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: 40 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      )}
    </Drawer>
  );
};

export default RolePermissionsDrawer;
