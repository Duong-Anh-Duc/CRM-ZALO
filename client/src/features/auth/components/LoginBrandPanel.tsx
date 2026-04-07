import React from 'react';
import { useTranslation } from 'react-i18next';
import logoImg from '@/assets/images/logo.jpg';

const LoginBrandPanel: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="lp-brand">
      <div className="lp-logo-wrap">
        <img src={logoImg} alt="PackFlow" className="lp-logo" />
        <div className="lp-ring" />
        <div className="lp-ring lp-ring-2" />
      </div>
      <h1 className="lp-brand-name">Pack<span>Flow</span></h1>
      <p className="lp-brand-sub">{t('auth.loginTitle')}</p>
      <div className="lp-dots">
        <span className="lp-dot" style={{ background: '#667eea' }} />
        <span className="lp-dot" style={{ background: '#764ba2' }} />
        <span className="lp-dot" style={{ background: '#4facfe' }} />
      </div>
    </div>
  );
};

export default LoginBrandPanel;
