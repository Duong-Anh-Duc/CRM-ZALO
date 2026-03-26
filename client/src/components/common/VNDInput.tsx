import React from 'react';
import { InputNumber, InputNumberProps } from 'antd';
import { useTranslation } from 'react-i18next';

type VNDInputProps = Omit<InputNumberProps, 'formatter' | 'parser'>;

const VNDInput: React.FC<VNDInputProps> = (props) => {
  const { t } = useTranslation();

  return (
    <InputNumber
      min={0}
      placeholder={t('payment.amountPlaceholder')}
      {...props}
      style={{ width: '100%', borderRadius: 8, ...props.style }}
      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' \u20AB'}
      parser={(v) => Number(v?.replace(/\./g, '').replace(/\s*\u20AB/, '') ?? 0)}
    />
  );
};

export default VNDInput;
