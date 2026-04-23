import { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Chatbot from '@/components/Chatbot';
import { usePermission } from '@/contexts/AbilityContext';
import { Layout, Menu, Dropdown, Avatar, Typography, Space, Drawer, theme, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  TeamOutlined,
  ShopOutlined,
  FileTextOutlined,
  ImportOutlined,
  DollarOutlined,
  SettingOutlined,
  UserOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CloseOutlined,
  RollbackOutlined,
  WalletOutlined,
  SunOutlined,
  MoonOutlined,
  FileSearchOutlined,
  SafetyOutlined,
  // GlobalOutlined, // disabled with Universe page
} from '@ant-design/icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import logoImg from '@/assets/images/logo.jpg';
import ProfileModal from '@/features/auth/components/ProfileModal';
import ChangePasswordModal from '@/features/auth/components/ChangePasswordModal';
import NotificationPopover from '@/features/alerts/components/NotificationPopover';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MOBILE_BREAKPOINT = 768;

// Flag SVG components (inline, no external deps)
const VNFlag = () => (
  <svg width="20" height="14" viewBox="0 0 30 20" style={{ borderRadius: 2, verticalAlign: 'middle' }}>
    <rect width="30" height="20" fill="#da251d" />
    <polygon points="15,4 16.76,9.41 22.58,9.41 17.91,12.59 19.67,18 15,14.82 10.33,18 12.09,12.59 7.42,9.41 13.24,9.41" fill="#ffff00" />
  </svg>
);

const ENFlag = () => (
  <svg width="20" height="14" viewBox="0 0 60 30" style={{ borderRadius: 2, verticalAlign: 'middle' }}>
    <clipPath id="s"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
    <clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
    <g clipPath="url(#s)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
    </g>
  </svg>
);

type MenuItem = NonNullable<MenuProps['items']>[number];

type PermCheck = (key: string) => boolean;

/**
 * Build sidebar menu items filtered by the current user's permissions.
 * Empty groups (no visible children) are omitted so the sidebar never
 * shows dangling section headers.
 */
const buildMenuItems = (t: (key: string) => string, hasPermission: PermCheck): MenuItem[] => {
  const items: MenuItem[] = [];

  if (hasPermission('dashboard.view')) {
    items.push({ key: '/', icon: <DashboardOutlined />, label: t('menu.dashboard') });
  }

  const catalog: MenuItem[] = [
    hasPermission('product.view') && { key: '/products', icon: <ShoppingOutlined />, label: t('menu.products') },
    hasPermission('customer.view') && { key: '/customers', icon: <TeamOutlined />, label: t('menu.customers') },
    hasPermission('supplier.view') && { key: '/suppliers', icon: <ShopOutlined />, label: t('menu.suppliers') },
  ].filter(Boolean) as MenuItem[];
  if (catalog.length) {
    items.push({ type: 'group', label: t('menu.catalog') }, ...catalog);
  }

  const orders: MenuItem[] = [
    hasPermission('sales_order.view') && { key: '/sales-orders', icon: <FileTextOutlined />, label: t('menu.salesOrders') },
    hasPermission('purchase_order.view') && { key: '/purchase-orders', icon: <ImportOutlined />, label: t('menu.purchaseOrders') },
    hasPermission('return.view') && { key: '/returns', icon: <RollbackOutlined />, label: t('menu.returns') },
  ].filter(Boolean) as MenuItem[];
  if (orders.length) {
    items.push({ type: 'group', label: t('menu.orders') }, ...orders);
  }

  const finance: MenuItem[] = [
    (hasPermission('receivable.view') || hasPermission('payable.view')) && { key: '/debts', icon: <DollarOutlined />, label: t('menu.debts') },
    hasPermission('cash_book.view') && { key: '/cash-book', icon: <WalletOutlined />, label: t('menu.cashBook') },
  ].filter(Boolean) as MenuItem[];
  if (finance.length) {
    items.push({ type: 'group', label: t('menu.finance') }, ...finance);
  }

  return items;
};

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canUseAiChat = usePermission('ai.chat');
  const { darkMode, toggleDarkMode } = useThemeStore();
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

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const menuItems: MenuProps['items'] = (() => {
    const base = buildMenuItems(t, hasPermission);
    const toolsAndAdmin: MenuItem[] = [
      hasPermission('user.view') && { key: '/users', icon: <UserOutlined />, label: t('menu.users') },
      hasPermission('audit_log.view') && { key: '/audit-logs', icon: <FileSearchOutlined />, label: t('auditLog.menuTitle') },
      hasPermission('role.manage') && { key: '/admin/roles', icon: <SafetyOutlined />, label: t('menu.roles') },
      hasPermission('role.manage') && { key: '/settings', icon: <SettingOutlined />, label: t('menu.settings') },
    ].filter(Boolean) as MenuItem[];

    if (toolsAndAdmin.length) {
      return [...base, { type: 'group' as const, label: t('menu.toolsAndAdmin') }, ...toolsAndAdmin];
    }
    return base;
  })();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => navigate(key);

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
    else if (key === 'profile') setProfileOpen(true);
    else if (key === 'change-password') setPasswordOpen(true);
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi');
  };

  const selectedKey = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return '/';
    // Support nested admin routes like /admin/roles — keep two segments.
    if (segments[0] === 'admin' && segments[1]) {
      return `/${segments[0]}/${segments[1]}`;
    }
    return `/${segments[0]}`;
  })();

  const siderContent = (
    <>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'center', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <img src={logoImg} alt="UNIKI" style={{ height: isMobile ? 32 : collapsed ? 28 : 38, maxWidth: isMobile ? 160 : collapsed ? 60 : 180, objectFit: 'contain', transition: 'all 0.2s ease', borderRadius: 6 }} />
        {isMobile && <CloseOutlined onClick={() => setMobileOpen(false)} style={{ color: '#fff', fontSize: 18, cursor: 'pointer' }} />}
      </div>
      <Menu theme="dark" mode="inline" selectedKeys={[selectedKey === '/' ? '/' : selectedKey]} items={menuItems} onClick={handleMenuClick} style={{ borderRight: 0 }} />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} trigger={null} width={240} className="crm-sider"
          style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0 }}>
          {siderContent}
        </Sider>
      )}

      {isMobile && (
        <Drawer placement="left" open={mobileOpen} onClose={() => setMobileOpen(false)} width={260}
          styles={{ header: { display: 'none' }, body: { padding: 0, background: '#001529' } }}>
          {siderContent}
        </Drawer>
      )}

      <Layout className="crm-layout-main" style={{ marginLeft: isMobile ? 0 : collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header className="crm-header" style={{ padding: isMobile ? '0 12px' : '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div onClick={() => isMobile ? setMobileOpen(true) : setCollapsed(!collapsed)} style={{ fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>
            {isMobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Space size={isMobile ? 8 : 16}>
            {/* Language toggle with flag */}
            <Tooltip title={i18n.language === 'vi' ? 'English' : 'Tiếng Việt'}>
              <div onClick={toggleLang} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, transition: 'background 0.2s' }}>
                {i18n.language === 'vi' ? <VNFlag /> : <ENFlag />}
                {!isMobile && <Text style={{ fontSize: 13 }}>{i18n.language === 'vi' ? 'VI' : 'EN'}</Text>}
              </div>
            </Tooltip>

            {/* Dark mode toggle */}
            <Tooltip title={darkMode ? t('common.lightMode') : t('common.darkMode')}>
              <div onClick={toggleDarkMode} style={{ cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', padding: 4 }}>
                {darkMode ? <SunOutlined style={{ color: '#faad14' }} /> : <MoonOutlined />}
              </div>
            </Tooltip>

            <NotificationPopover />

            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight" trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                {!isMobile && <Text>{user?.full_name}</Text>}
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="crm-content" style={{ margin: isMobile ? 8 : 16, padding: isMobile ? 12 : 24, background: colorBgContainer, minHeight: 360, borderRadius: 12 }}>
          <Outlet />
        </Content>
      </Layout>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      {canUseAiChat && <Chatbot />}
    </Layout>
  );
};

export default AppLayout;
