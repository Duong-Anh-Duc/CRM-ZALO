import React, { useMemo } from 'react';
import { Modal, Descriptions, Typography, Tag, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { AuditLog } from '../types';

const { Text } = Typography;

interface Props {
  log: AuditLog | null;
  open: boolean;
  onClose: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red', UPSERT: 'purple',
};

// Fields that are noise to non-tech users — always hidden
const HIDDEN_FIELDS = new Set(['id', 'created_at', 'updated_at', 'deleted_at']);

interface DiffRow {
  field: string;
  before: unknown;
  after: unknown;
  kind: 'added' | 'removed' | 'changed';
}

function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  if (obj == null || typeof obj !== 'object') return prefix ? { [prefix]: obj } : {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      out[key] = v;
    } else if (v != null && typeof v === 'object' && !(v instanceof Date)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function eq(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function computeDiff(oldData: unknown, newData: unknown): DiffRow[] {
  const o = flatten(oldData);
  const n = flatten(newData);
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]))
    .filter((k) => {
      const leaf = k.split('.').pop() || k;
      return !HIDDEN_FIELDS.has(leaf);
    })
    .sort();
  const rows: DiffRow[] = [];
  for (const k of keys) {
    const before = o[k];
    const after = n[k];
    if (eq(before, after)) continue;
    const bEmpty = isEmpty(before);
    const aEmpty = isEmpty(after);
    const kind: DiffRow['kind'] = bEmpty && !aEmpty ? 'added' : !bEmpty && aEmpty ? 'removed' : 'changed';
    rows.push({ field: k, before, after, kind });
  }
  return rows;
}

const AuditLogDetailModal: React.FC<Props> = ({ log, open, onClose }) => {
  const { t } = useTranslation();

  const diff = useMemo(() => {
    if (!log) return [];
    if (log.action === 'CREATE') return computeDiff(null, log.new_data);
    if (log.action === 'DELETE') return computeDiff(log.old_data, null);
    return computeDiff(log.old_data, log.new_data);
  }, [log]);

  if (!log) return null;

  const actionKey = `auditLog.actions.${log.action}`;
  const actionLabel = t(actionKey) === actionKey ? log.action : t(actionKey);
  const modelKey = `auditLog.models.${log.model_name}`;
  const modelLabel = t(modelKey) === modelKey ? log.model_name : t(modelKey);

  const translateField = (field: string): string =>
    field
      .split('.')
      .map((p) => {
        if (/^\d+$/.test(p)) return `#${Number(p) + 1}`;
        const k = `auditLog.fields.${p}`;
        const v = t(k);
        return v === k ? p : v;
      })
      .join(' › ');

  const renderValue = (v: unknown): string => {
    if (isEmpty(v)) return t('auditLog.valueEmpty');
    if (typeof v === 'boolean') return v ? t('auditLog.valueYes') : t('auditLog.valueNo');
    if (Array.isArray(v)) return t('auditLog.valueItems', { count: v.length });
    if (v instanceof Date) return dayjs(v).format('DD/MM/YYYY HH:mm');
    const s = String(v);
    // ISO date detection
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return dayjs(s).format('DD/MM/YYYY HH:mm');
    // UUID — shorten
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return `${s.slice(0, 8)}…`;
    return s.length > 120 ? `${s.slice(0, 120)}…` : s;
  };

  const sectionTitle =
    log.action === 'CREATE' ? t('auditLog.addedOnCreate')
      : log.action === 'DELETE' ? t('auditLog.removedOnDelete')
      : t('auditLog.changes');

  return (
    <Modal
      open={open}
      title={t('auditLog.detailTitle')}
      footer={null}
      width={720}
      onCancel={onClose}
    >
      <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label={t('auditLog.time')}>{dayjs(log.created_at).format('DD/MM/YYYY HH:mm:ss')}</Descriptions.Item>
        <Descriptions.Item label={t('auditLog.action')}><Tag color={ACTION_COLORS[log.action]}>{actionLabel}</Tag></Descriptions.Item>
        <Descriptions.Item label={t('auditLog.operator')}>
          {log.user_full_name ? <><Text strong>{log.user_full_name}</Text><Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>({log.user_name})</Text></> : log.user_name || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('auditLog.ip')}>{log.ip_address || '—'}</Descriptions.Item>
        <Descriptions.Item label={t('auditLog.model')} span={2}>{modelLabel}</Descriptions.Item>
      </Descriptions>

      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
        {sectionTitle} ({diff.length})
      </Text>

      {diff.length === 0 ? (
        <Empty description={t('auditLog.noChanges')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ maxHeight: 460, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
          {diff.map((d, i) => {
            const label = translateField(d.field);
            return (
              <div
                key={d.field}
                style={{
                  padding: '10px 14px',
                  borderBottom: i < diff.length - 1 ? '1px solid #f5f5f5' : 'none',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <Text strong>{label}</Text>
                </div>
                {d.kind === 'added' && (
                  <div>
                    <Tag color="green" style={{ borderRadius: 4 }}>{t('auditLog.changeAdded')}</Tag>
                    <Text style={{ color: '#237804' }}>{renderValue(d.after)}</Text>
                  </div>
                )}
                {d.kind === 'removed' && (
                  <div>
                    <Tag color="red" style={{ borderRadius: 4 }}>{t('auditLog.changeRemoved')}</Tag>
                    <Text delete style={{ color: '#a8071a' }}>{renderValue(d.before)}</Text>
                  </div>
                )}
                {d.kind === 'changed' && (
                  <div>
                    <Text type="secondary">{t('auditLog.changeFromTo')} </Text>
                    <Text delete style={{ color: '#cf1322' }}>{renderValue(d.before)}</Text>
                    <Text type="secondary"> {t('auditLog.changeTo')} </Text>
                    <Text strong style={{ color: '#237804' }}>{renderValue(d.after)}</Text>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default AuditLogDetailModal;
