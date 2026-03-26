import React from 'react';
import { Typography, Flex } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface Phase2PlaceholderProps {
  title?: string;
}

const Phase2Placeholder: React.FC<Phase2PlaceholderProps> = ({ title }) => {
  const { t } = useTranslation();

  return (
    <Flex
      className="phase2-placeholder"
      justify="center"
      align="center"
      vertical
      gap={12}
      style={{
        border: '2px dashed #d9d9d9',
        borderRadius: 12,
        padding: '48px 24px',
        background: '#fafafa',
        color: '#bfbfbf',
      }}
    >
      <LockOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
      <Typography.Text type="secondary" style={{ fontSize: 16 }}>
        {title ?? t('common.phase2Zalo')}
      </Typography.Text>
    </Flex>
  );
};

export default Phase2Placeholder;
