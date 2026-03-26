export type PlasticMaterial = 'PET' | 'HDPE' | 'PP' | 'PVC' | 'PS' | 'ABS';
export type ProductColor = 'TRANSPARENT' | 'WHITE' | 'CUSTOM';
export type ProductShape = 'ROUND' | 'SQUARE' | 'OVAL' | 'FLAT';
export type NeckType = 'WIDE' | 'NARROW' | 'PUMP' | 'SPRAY' | 'SCREW';
export type UnitOfSale = 'PIECE' | 'CARTON' | 'KG';
export type Industry = 'FOOD' | 'COSMETICS' | 'CHEMICAL' | 'PHARMA' | 'HOUSEHOLD';
export type SafetyStandard = 'FDA_FOOD_GRADE' | 'BPA_FREE' | 'ISO';

export interface PriceTier {
  id?: string;
  min_qty: number;
  price: number;
}

export interface SupplierPrice {
  id: string;
  supplier_id: string;
  product_id: string;
  purchase_price: number;
  moq?: number;
  lead_time_days?: number;
  is_preferred: boolean;
  supplier: { id: string; company_name: string };
}

export interface ProductImage {
  id: string;
  url: string;
  public_id?: string;
  is_primary: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id?: string;
  category?: { id: string; name: string };
  description?: string;
  material?: PlasticMaterial;
  capacity_ml?: number;
  height_mm?: number;
  body_dia_mm?: number;
  neck_dia_mm?: number;
  weight_g?: number;
  color?: ProductColor;
  custom_color?: string;
  shape?: ProductShape;
  neck_type?: NeckType;
  neck_spec?: string;
  unit_of_sale: UnitOfSale;
  pcs_per_carton?: number;
  carton_weight?: number;
  carton_length?: number;
  carton_width?: number;
  carton_height?: number;
  industries: Industry[];
  safety_standards: SafetyStandard[];
  moq?: number;
  retail_price?: number;
  wholesale_price?: number;
  catalog_pdf_url?: string;
  is_active: boolean;
  images: ProductImage[];
  price_tiers: PriceTier[];
  supplier_prices: SupplierPrice[];
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
  children?: Category[];
}

export interface ProductCombo {
  id: string;
  name: string;
  description?: string;
  combo_price: number;
  is_active: boolean;
  items: ComboItem[];
}

export interface ComboItem {
  id: string;
  combo_id: string;
  product_id: string;
  quantity: number;
  product?: Product;
}
