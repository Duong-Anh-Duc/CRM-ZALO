import React from 'react';
import { Spin, Flex } from 'antd';
import { useTranslation } from 'react-i18next';

const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Flex
      justify="center"
      align="center"
      style={{ minHeight: '100vh', width: '100%' }}
    >
      <Spin size="large" tip={t('common.loading')}>
        <div style={{ padding: 50 }} />
      </Spin>
    </Flex>
  );
};

export default LoadingScreen;
