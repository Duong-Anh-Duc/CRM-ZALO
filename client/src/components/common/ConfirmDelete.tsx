import React from 'react';
import { Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteProps } from './types';

const ConfirmDelete: React.FC<ConfirmDeleteProps> = ({ title, onConfirm, children }) => {
  const { t } = useTranslation();

  return (
    <Popconfirm
      title={title}
      onConfirm={onConfirm}
      okText={t('common.delete')}
      cancelText={t('common.cancel')}
      okButtonProps={{ danger: true }}
    >
      {children}
    </Popconfirm>
  );
};

export default ConfirmDelete;
