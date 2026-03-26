import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Badge, Avatar, Typography, Space, Select, Drawer, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  TeamOutlined,
  ShopOutlined,
  FileTextOutlined,
  ImportOutlined,
  DollarOutlined,
  WalletOutlined,
  AccountBookOutlined,
  BarChartOutlined,
  BellOutlined,
  SettingOutlined,
  UserOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GlobalOutlined,
  MessageOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import apiClient from '@/lib/api-client';
import logoImg from '@/assets/images/logo.jpg';
import ProfileModal from '@/features/auth/components/ProfileModal';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MOBILE_BREAKPOINT = 768;

const getMenuItems = (t: (key: string) => string) => [
  { key: '/', icon: <DashboardOutlined />, label: t('menu.dashboard') },
  { key: '/products', icon: <ShoppingOutlined />, label: t('menu.products') },
  { key: '/customers', icon: <TeamOutlined />, label: t('menu.customers') },
  { key: '/suppliers', icon: <ShopOutlined />, label: t('menu.suppliers') },
  { key: '/sales-orders', icon: <FileTextOutlined />, label: t('menu.salesOrders') },
  { key: '/purchase-orders', icon: <ImportOutlined />, label: t('menu.purchaseOrders') },
  { key: '/receivables', icon: <DollarOutlined />, label: t('menu.receivables') },
  { key: '/payables', icon: <WalletOutlined />, label: t('menu.payables') },
  { key: '/operating-costs', icon: <AccountBookOutlined />, label: t('menu.operatingCosts') },
  { key: '/zalo', icon: <MessageOutlined />, label: t('menu.zalo') },
  { key: '/reports', icon: <BarChartOutlined />, label: t('menu.reports') },
];

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'password'>('profile');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasRole } = useAuthStore();
  const { token: { colorBgContainer } } = theme.useToken();
  const { t, i18n } = useTranslation();

  const handleResize = useCallback(() => {
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    if (!mobile) setMobileOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    fetchUnreadAlerts();
    const interval = setInterval(fetchUnreadAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile drawer on navigate
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const fetchUnreadAlerts = async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: { count: number } }>(
        '/alerts/unread-count',
      );
      setUnreadCount(res.data.data.count);
    } catch {
      // silent fail
    }
  };

  const menuItems: MenuProps['items'] = [
    ...getMenuItems(t).map((item) => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
    })),
    ...(hasRole('ADMIN')
      ? [{ key: '/settings', icon: <SettingOutlined />, label: t('menu.settings') }]
      : []),
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    toast.success(t('auth.logoutSuccess'));
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: t('auth.profile') },
    { key: 'change-password', icon: <LockOutlined />, label: t('auth.changePassword') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: t('auth.logout'), danger: true },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') handleLogout();
    else if (key === 'profile') { setProfileTab('profile'); setProfileOpen(true); }
    else if (key === 'change-password') { setProfileTab('password'); setProfileOpen(true); }
  };

  const selectedKey = '/' + location.pathname.split('/').filter(Boolean)[0] || '/';

  const siderContent = (
    <>
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : 'center',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <img
          src={logoImg}
          alt="UNIKI"
          style={{
            height: isMobile ? 32 : collapsed ? 28 : 38,
            maxWidth: isMobile ? 160 : collapsed ? 60 : 180,
            objectFit: 'contain',
            transition: 'all 0.2s ease',
            borderRadius: 6,
          }}
        />
        {isMobile && (
          <CloseOutlined
            onClick={() => setMobileOpen(false)}
            style={{ color: '#fff', fontSize: 18, cursor: 'pointer' }}
          />
        )}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey === '/' ? '/' : selectedKey]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 0 }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={240}
          className="crm-sider"
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
          }}
        >
          {siderContent}
        </Sider>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          width={260}
          styles={{
            header: { display: 'none' },
            body: { padding: 0, background: '#001529' },
          }}
        >
          {siderContent}
        </Drawer>
      )}

      <Layout
        className="crm-layout-main"
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 240,
          transition: 'margin-left 0.2s',
        }}
      >
        <Header
          className="crm-header"
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            onClick={() => isMobile ? setMobileOpen(true) : setCollapsed(!collapsed)}
            style={{ fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >
            {isMobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Space size={isMobile ? 'small' : 'middle'}>
            {!isMobile && (
              <Space size={4}>
                <GlobalOutlined />
                <Select
                  value={i18n.language}
                  onChange={(lang) => i18n.changeLanguage(lang)}
                  size="small"
                  variant="borderless"
                  style={{ width: 110 }}
                  options={[
                    { label: 'Tiếng Việt', value: 'vi' },
                    { label: 'English', value: 'en' },
                  ]}
                />
              </Space>
            )}
            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
              <BellOutlined
                style={{ fontSize: 18, cursor: 'pointer', color: '#595959' }}
                onClick={() => navigate('/alerts')}
              />
            </Badge>
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                {!isMobile && <Text>{user?.full_name}</Text>}
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          className="crm-content"
          style={{
            margin: isMobile ? 8 : 16,
            padding: isMobile ? 12 : 24,
            background: colorBgContainer,
            minHeight: 360,
            borderRadius: 12,
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      <ProfileModal
        open={profileOpen}
        defaultTab={profileTab}
        onClose={() => setProfileOpen(false)}
      />
    </Layout>
  );
};

export default AppLayout;
