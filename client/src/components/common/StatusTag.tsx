import React from 'react';
import { Tag } from 'antd';
import { statusColors } from '@/constants/status';
import {
  salesStatusLabels,
  purchaseStatusLabels,
  debtStatusLabels,
  returnStatusLabels,
} from '@/utils/format';
import { StatusTagProps } from './types';

const labelMaps: Record<string, Record<string, string>> = {
  sales: salesStatusLabels,
  purchase: purchaseStatusLabels,
  debt: debtStatusLabels,
  return: returnStatusLabels,
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
