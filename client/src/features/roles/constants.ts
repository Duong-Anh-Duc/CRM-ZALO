import React from 'react';
import {
  SafetyOutlined,
  CrownOutlined,
  WalletOutlined,
  TeamOutlined,
  UserOutlined,
  ShoppingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ContainerOutlined,
  FileTextOutlined,
  RollbackOutlined,
  DollarOutlined,
  BankOutlined,
  ExperimentOutlined,
  IdcardOutlined,
  DashboardOutlined,
  BarChartOutlined,
  FileSearchOutlined,
  MessageOutlined,
  TagOutlined,
  AppstoreOutlined,
  ReadOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  ControlOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  CloseCircleOutlined,
  LockOutlined,
  UnlockOutlined,
  ToolOutlined,
  BookOutlined,
  SettingOutlined,
} from '@ant-design/icons';

export interface RoleVisual {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  gradient: string;
  solid: string;
  tint: string;
  border: string;
}

// Role visuals by slug; fallback used if slug not matched
export const ROLE_VISUALS: Record<string, RoleVisual> = {
  admin: {
    icon: SafetyOutlined,
    gradient: 'linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%)',
    solid: '#c9184a',
    tint: 'rgba(201, 24, 74, 0.08)',
    border: '#c9184a',
  },
  manager: {
    icon: CrownOutlined,
    gradient: 'linear-gradient(135deg, #a06cd5 0%, #6247aa 100%)',
    solid: '#6247aa',
    tint: 'rgba(98, 71, 170, 0.08)',
    border: '#6247aa',
  },
  accountant: {
    icon: WalletOutlined,
    gradient: 'linear-gradient(135deg, #f6bd60 0%, #d98e04 100%)',
    solid: '#d98e04',
    tint: 'rgba(217, 142, 4, 0.08)',
    border: '#d98e04',
  },
  sales: {
    icon: TeamOutlined,
    gradient: 'linear-gradient(135deg, #4cc9f0 0%, #1677ff 100%)',
    solid: '#1677ff',
    tint: 'rgba(22, 119, 255, 0.08)',
    border: '#1677ff',
  },
};

export const DEFAULT_ROLE_VISUAL: RoleVisual = {
  icon: UserOutlined,
  gradient: 'linear-gradient(135deg, #5a67d8 0%, #3b4cb8 100%)',
  solid: '#3b4cb8',
  tint: 'rgba(59, 76, 184, 0.08)',
  border: '#3b4cb8',
};

export function getRoleVisual(slug: string): RoleVisual {
  return ROLE_VISUALS[slug] ?? DEFAULT_ROLE_VISUAL;
}

// Module icon mapping
type IconComp = React.ComponentType<{ style?: React.CSSProperties }>;

export const MODULE_ICONS: Record<string, IconComp> = {
  customer: TeamOutlined,
  product: ShoppingOutlined,
  category: AppstoreOutlined,
  supplier: ShopOutlined,
  sales_order: ShoppingCartOutlined,
  purchase_order: ContainerOutlined,
  invoice: FileTextOutlined,
  return: RollbackOutlined,
  receivable: DollarOutlined,
  payable: BankOutlined,
  cash_book: WalletOutlined,
  operating_cost: ExperimentOutlined,
  payroll: IdcardOutlined,
  employee: IdcardOutlined,
  user: UserOutlined,
  role: SafetyOutlined,
  dashboard: DashboardOutlined,
  report: BarChartOutlined,
  audit_log: FileSearchOutlined,
  zalo: MessageOutlined,
  pricing: TagOutlined,
  price: TagOutlined,
  alert: BookOutlined,
  settings: SettingOutlined,
  ai_training: ExperimentOutlined,
};

export function getModuleIcon(module: string): IconComp {
  return MODULE_ICONS[module] ?? AppstoreOutlined;
}

// Action color mapping for badges
export interface ActionVisual {
  color: string;
  label?: string;
  icon?: IconComp;
}

export const ACTION_VISUALS: Record<string, ActionVisual> = {
  read: { color: '#1677ff', icon: ReadOutlined },
  list: { color: '#1677ff', icon: ReadOutlined },
  view: { color: '#1677ff', icon: ReadOutlined },
  create: { color: '#52c41a', icon: PlusCircleOutlined },
  update: { color: '#fa8c16', icon: EditOutlined },
  edit: { color: '#fa8c16', icon: EditOutlined },
  delete: { color: '#ff4d4f', icon: DeleteOutlined },
  remove: { color: '#ff4d4f', icon: DeleteOutlined },
  manage: { color: '#722ed1', icon: ControlOutlined },
  approve: { color: '#faad14', icon: CheckCircleOutlined },
  export: { color: '#13c2c2', icon: DownloadOutlined },
  finalize: { color: '#595959', icon: LockOutlined },
  cancel: { color: '#595959', icon: CloseCircleOutlined },
  unlock: { color: '#13c2c2', icon: UnlockOutlined },
  record_payment: { color: '#faad14', icon: DollarOutlined },
  configure: { color: '#722ed1', icon: ToolOutlined },
};

export function getActionVisual(action: string): ActionVisual {
  return ACTION_VISUALS[action] ?? { color: '#8c8c8c' };
}

// Card / style tokens
export const CARD_RADIUS = 12;
export const INNER_RADIUS = 8;
export const SHADOW_BASE = '0 2px 8px rgba(0, 0, 0, 0.06)';
export const SHADOW_HOVER = '0 4px 16px rgba(0, 0, 0, 0.1)';
