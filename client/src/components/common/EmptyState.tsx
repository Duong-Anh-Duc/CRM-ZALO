import React from 'react';
import { Empty, Button } from 'antd';
import { EmptyStateProps } from './types';

const EmptyState: React.FC<EmptyStateProps> = ({ message, actionLabel, onAction }) => (
  <Empty
    description={message}
    style={{ padding: '48px 0' }}
  >
    {actionLabel && onAction && (
      <Button
        type="primary"
        onClick={onAction}
        style={{ borderRadius: 8 }}
      >
        {actionLabel}
      </Button>
    )}
  </Empty>
);

export default EmptyState;
