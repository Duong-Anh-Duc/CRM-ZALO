import React from 'react';
import { Tag } from 'antd';
import { statusColors } from '@/constants/status';
import {
  salesStatusLabels,
  purchaseStatusLabels,
  debtStatusLabels,
} from '@/utils/format';

interface StatusTagProps {
  status: string;
  type?: 'sales' | 'purchase' | 'debt';
}

const labelMaps: Record<string, Record<string, string>> = {
  sales: salesStatusLabels,
  purchase: purchaseStatusLabels,
  debt: debtStatusLabels,
};

const StatusTag: React.FC<StatusTagProps> = ({ status, type = 'sales' }) => {
  const labels = labelMaps[type] ?? salesStatusLabels;
  const label = labels[status] ?? status;
  const color = statusColors[status] ?? 'default';

  return (
    <Tag color={color} style={{ borderRadius: 8 }}>
      {label}
    </Tag>
  );
};

export default StatusTag;
