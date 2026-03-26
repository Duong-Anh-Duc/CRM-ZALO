import React from 'react';
import { Button, Result } from 'antd';
import i18n from '@/locales';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={i18n.t('errors.errorOccurred')}
          subTitle={this.state.error?.message || i18n.t('errors.pleaseTryAgain')}
          extra={
            <Button type="primary" onClick={this.handleReset} style={{ borderRadius: 8 }}>
              {i18n.t('errors.retry')}
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
