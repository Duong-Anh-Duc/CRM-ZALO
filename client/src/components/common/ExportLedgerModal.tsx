import React, { useState } from 'react';
import { Modal, DatePicker, Space, Button, Segmented, Typography, Divider } from 'antd';
import { FileExcelOutlined, FilePdfOutlined, EyeOutlined, CalendarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;

type Period = 'all' | 'month' | 'quarter' | 'year' | 'custom';
export type ExportFormat = 'excel' | 'pdf';
export type ExportAction = ExportFormat | 'preview' | 'preview-excel';

interface Props {
  open: boolean;
  loading?: ExportAction | null;
  onClose: () => void;
  onConfirm: (action: ExportAction, range: { from_date?: string; to_date?: string }) => void;
}

export const ExportLedgerModal: React.FC<Props> = ({ open, loading, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('all');
  const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null);

  const buildRange = () => {
    const now = dayjs();
    let from: Dayjs | undefined;
    let to: Dayjs | undefined;
    if (period === 'month') { from = now.startOf('month'); to = now.endOf('month'); }
    else if (period === 'quarter') {
      const qStartMonth = Math.floor(now.month() / 3) * 3;
      from = now.month(qStartMonth).startOf('month');
      to = now.month(qStartMonth + 2).endOf('month');
    }
    else if (period === 'year') { from = now.startOf('year'); to = now.endOf('year'); }
    else if (period === 'custom' && custom) { [from, to] = custom; }
    return {
      from_date: from?.format('YYYY-MM-DD'),
      to_date: to?.format('YYYY-MM-DD'),
    };
  };

  const invalidCustom = period === 'custom' && !custom;
  const busy = !!loading;

  const periodOptions = [
    { label: t('debt.exportAllTime'), value: 'all' },
    { label: t('debt.exportThisMonth'), value: 'month' },
    { label: t('debt.exportThisQuarter'), value: 'quarter' },
    { label: t('debt.exportThisYear'), value: 'year' },
    { label: t('debt.exportCustom'), value: 'custom' },
  ];

  const rangePreview = (() => {
    const r = buildRange();
    if (!r.from_date && !r.to_date) return t('debt.exportAllTime');
    const f = r.from_date ? dayjs(r.from_date).format('DD/MM/YYYY') : '—';
    const tx = r.to_date ? dayjs(r.to_date).format('DD/MM/YYYY') : '—';
    return `${f} → ${tx}`;
  })();

  return (
    <Modal
      open={open}
      title={t('debt.exportOptions')}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      <div>
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
          {t('debt.exportPeriodLabel')}
        </Text>
        <Segmented
          block
          value={period}
          onChange={(v) => setPeriod(v as Period)}
          options={periodOptions}
          disabled={busy}
        />
        {period === 'custom' ? (
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            value={custom as any}
            onChange={(d) => setCustom(d as any)}
            style={{ width: '100%', borderRadius: 8, marginTop: 12 }}
            placeholder={[t('common.fromDate'), t('common.toDate')]}
            disabled={busy}
          />
        ) : (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: '#fafafa',
              borderRadius: 8,
              fontSize: 12,
              color: '#595959',
            }}
          >
            <CalendarOutlined style={{ marginRight: 6 }} />
            {rangePreview}
          </div>
        )}
      </div>

      <Divider style={{ margin: '20px 0 16px' }} />

      <Space style={{ width: '100%', justifyContent: 'flex-end' }} wrap>
        <Button
          icon={<EyeOutlined />}
          loading={loading === 'preview'}
          disabled={invalidCustom || (busy && loading !== 'preview')}
          onClick={() => onConfirm('preview', buildRange())}
        >
          {t('debt.exportPreviewPdf')}
        </Button>
        <Button
          icon={<EyeOutlined />}
          loading={loading === 'preview-excel'}
          disabled={invalidCustom || (busy && loading !== 'preview-excel')}
          onClick={() => onConfirm('preview-excel', buildRange())}
        >
          {t('debt.exportPreviewExcel')}
        </Button>
        <Button
          icon={<FilePdfOutlined />}
          loading={loading === 'pdf'}
          disabled={invalidCustom || (busy && loading !== 'pdf')}
          onClick={() => onConfirm('pdf', buildRange())}
        >
          {t('debt.exportPdf')}
        </Button>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          loading={loading === 'excel'}
          disabled={invalidCustom || (busy && loading !== 'excel')}
          onClick={() => onConfirm('excel', buildRange())}
        >
          {t('debt.exportExcel')}
        </Button>
      </Space>
    </Modal>
  );
};
