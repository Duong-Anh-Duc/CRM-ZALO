import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme as antTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@/locales';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/stores/theme.store';
import '@/styles/global.css';
import '@/styles/login.css';
import '@/styles/responsive.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppWrapper() {
  const { i18n } = useTranslation();
  const antdLocale = i18n.language === 'en' ? enUS : viVN;
  const darkMode = useThemeStore((s) => s.darkMode);

  // Sync body background with theme
  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? '#141414' : '#f5f5f5';
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: darkMode ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, sans-serif",
        },
        components: {
          Card: { borderRadiusLG: 12 },
          Button: { borderRadius: 8 },
          Input: { borderRadius: 8 },
          Select: { borderRadius: 8 },
        },
      }}
    >
      <BrowserRouter>
        <App />
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar theme={darkMode ? 'dark' : 'light'} />
      </BrowserRouter>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppWrapper />
    </QueryClientProvider>
  </React.StrictMode>
);
