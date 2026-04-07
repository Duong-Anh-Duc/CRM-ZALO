import React from 'react';
import { Button, Result } from 'antd';
import i18n from '@/locales';
import { ErrorBoundaryProps, ErrorBoundaryState } from './types';

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
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
