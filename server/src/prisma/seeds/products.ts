import { PrismaClient, Supplier } from '@prisma/client';

const productsData = [
  { sku: 'PLB-PET-2026-0001', name: 'Chai PET 100ml cổ hẹp', category_id: 'chai-pet', material: 'PET', capacity_ml: 100, height_mm: 115, body_dia_mm: 40, neck_dia_mm: 24, weight_g: 12, color: 'TRANSPARENT', shape: 'ROUND', neck_type: 'SCREW', neck_spec: '24/410', unit_of_sale: 'PIECE', pcs_per_carton: 200, retail_price: 1500, wholesale_price: 1200, moq: 500, industries: ['COSMETICS', 'PHARMA'], safety_standards: ['FDA_FOOD_GRADE', 'BPA_FREE'] },
  { sku: 'PLB-PET-2026-0002', name: 'Chai PET 250ml nước suối', category_id: 'chai-pet', material: 'PET', capacity_ml: 250, height_mm: 165, body_dia_mm: 55, neck_dia_mm: 28, weight_g: 18, color: 'TRANSPARENT', shape: 'ROUND', neck_type: 'SCREW', neck_spec: 'PCO28', unit_of_sale: 'PIECE', pcs_per_carton: 120, retail_price: 2000, wholesale_price: 1600, moq: 1000, industries: ['FOOD'], safety_standards: ['FDA_FOOD_GRADE'] },
  { sku: 'PLB-PET-2026-0003', name: 'Chai PET 500ml đa năng', category_id: 'chai-pet', material: 'PET', capacity_ml: 500, height_mm: 210, body_dia_mm: 65, neck_dia_mm: 28, weight_g: 25, color: 'TRANSPARENT', shape: 'ROUND', neck_type: 'SCREW', neck_spec: 'PCO28', unit_of_sale: 'PIECE', pcs_per_carton: 80, retail_price: 3000, wholesale_price: 2500, moq: 500, industries: ['FOOD', 'HOUSEHOLD'], safety_standards: ['FDA_FOOD_GRADE', 'BPA_FREE'] },
  { sku: 'PLB-PET-2026-0004', name: 'Chai PET 1000ml nước giải khát', category_id: 'chai-pet', material: 'PET', capacity_ml: 1000, height_mm: 280, body_dia_mm: 80, neck_dia_mm: 28, weight_g: 38, color: 'TRANSPARENT', shape: 'ROUND', neck_type: 'SCREW', neck_spec: 'PCO28', unit_of_sale: 'PIECE', pcs_per_carton: 48, retail_price: 4500, wholesale_price: 3800, moq: 500, industries: ['FOOD'], safety_standards: ['FDA_FOOD_GRADE'] },
  { sku: 'PLB-HDPE-2026-0001', name: 'Can HDPE 1L hóa chất', category_id: 'can-1l-5l', material: 'HDPE', capacity_ml: 1000, height_mm: 200, body_dia_mm: 95, neck_dia_mm: 38, weight_g: 55, color: 'WHITE', shape: 'ROUND', neck_type: 'SCREW', neck_spec: '38/400', unit_of_sale: 'PIECE', pcs_per_carton: 40, retail_price: 8000, wholesale_price: 6500, moq: 200, industries: ['CHEMICAL', 'HOUSEHOLD'], safety_standards: ['BPA_FREE'] },
  { sku: 'PLB-HDPE-2026-0002', name: 'Can HDPE 5L vuông', category_id: 'can-1l-5l', material: 'HDPE', capacity_ml: 5000, height_mm: 300, body_dia_mm: 160, neck_dia_mm: 42, weight_g: 180, color: 'WHITE', shape: 'SQUARE', neck_type: 'SCREW', neck_spec: '42/410', unit_of_sale: 'PIECE', pcs_per_carton: 12, retail_price: 25000, wholesale_price: 20000, moq: 100, industries: ['CHEMICAL', 'HOUSEHOLD'], safety_standards: ['BPA_FREE'] },
  { sku: 'PLB-PP-2026-0001', name: 'Hũ PP 100ml mỹ phẩm', category_id: 'hũ-tròn', material: 'PP', capacity_ml: 100, height_mm: 55, body_dia_mm: 60, neck_dia_mm: 60, weight_g: 20, color: 'WHITE', shape: 'ROUND', neck_type: 'WIDE', neck_spec: '60/400', unit_of_sale: 'PIECE', pcs_per_carton: 200, retail_price: 5000, wholesale_price: 4000, moq: 300, industries: ['COSMETICS'], safety_standards: ['FDA_FOOD_GRADE', 'BPA_FREE'] },
  { sku: 'PLB-PP-2026-0002', name: 'Hũ PP 250ml thực phẩm', category_id: 'hũ-tròn', material: 'PP', capacity_ml: 250, height_mm: 80, body_dia_mm: 75, neck_dia_mm: 75, weight_g: 30, color: 'TRANSPARENT', shape: 'ROUND', neck_type: 'WIDE', neck_spec: '75/400', unit_of_sale: 'PIECE', pcs_per_carton: 120, retail_price: 6000, wholesale_price: 4800, moq: 300, industries: ['FOOD'], safety_standards: ['FDA_FOOD_GRADE'] },
  { sku: 'PLB-PET-2026-0005', name: 'Lọ PET 50ml serum', category_id: 'lọ-mỹ-phẩm', material: 'PET', capacity_ml: 50, height_mm: 95, body_dia_mm: 32, neck_dia_mm: 20, weight_g: 8, color: 'TRANSPARENT', shape: 'ROUND', neck_type: 'NARROW', neck_spec: '20/410', unit_of_sale: 'PIECE', pcs_per_carton: 300, retail_price: 3500, wholesale_price: 2800, moq: 500, industries: ['COSMETICS'], safety_standards: ['BPA_FREE'] },
  { sku: 'PLB-PET-2026-0006', name: 'Chai PET 200ml xịt', category_id: 'chai-pet', material: 'PET', capacity_ml: 200, height_mm: 155, body_dia_mm: 48, neck_dia_mm: 24, weight_g: 15, color: 'TRANSPARENT', shape: 'ROUND', neck_type: 'SPRAY', neck_spec: '24/410', unit_of_sale: 'PIECE', pcs_per_carton: 150, retail_price: 2500, wholesale_price: 2000, moq: 500, industries: ['COSMETICS', 'HOUSEHOLD'], safety_standards: ['BPA_FREE'] },
  // Accessories
  { sku: 'PLB-PP-2026-0003', name: 'Nắp vặn PP 24/410', category_id: 'nắp-vặn', material: 'PP', capacity_ml: null, height_mm: 18, body_dia_mm: null, neck_dia_mm: 24, weight_g: 3, color: 'WHITE', shape: 'ROUND', neck_type: 'SCREW', neck_spec: '24/410', unit_of_sale: 'PIECE', pcs_per_carton: 1000, retail_price: 500, wholesale_price: 350, moq: 1000, industries: ['COSMETICS', 'PHARMA', 'FOOD'], safety_standards: ['FDA_FOOD_GRADE'] },
  { sku: 'PLB-PP-2026-0004', name: 'Nắp vặn PP PCO28', category_id: 'nắp-vặn', material: 'PP', capacity_ml: null, height_mm: 20, body_dia_mm: null, neck_dia_mm: 28, weight_g: 4, color: 'WHITE', shape: 'ROUND', neck_type: 'SCREW', neck_spec: 'PCO28', unit_of_sale: 'PIECE', pcs_per_carton: 800, retail_price: 600, wholesale_price: 450, moq: 1000, industries: ['FOOD'], safety_standards: ['FDA_FOOD_GRADE'] },
  { sku: 'PLB-PP-2026-0005', name: 'Đầu bơm 24/410', category_id: 'nắp-bơm', material: 'PP', capacity_ml: null, height_mm: 120, body_dia_mm: null, neck_dia_mm: 24, weight_g: 8, color: 'WHITE', shape: 'ROUND', neck_type: 'PUMP', neck_spec: '24/410', unit_of_sale: 'PIECE', pcs_per_carton: 500, retail_price: 2000, wholesale_price: 1500, moq: 500, industries: ['COSMETICS', 'HOUSEHOLD'], safety_standards: ['BPA_FREE'] },
  { sku: 'PLB-PP-2026-0006', name: 'Đầu xịt sương 24/410', category_id: 'nắp-xịt', material: 'PP', capacity_ml: null, height_mm: 130, body_dia_mm: null, neck_dia_mm: 24, weight_g: 10, color: 'WHITE', shape: 'ROUND', neck_type: 'SPRAY', neck_spec: '24/410', unit_of_sale: 'PIECE', pcs_per_carton: 400, retail_price: 2500, wholesale_price: 1800, moq: 500, industries: ['COSMETICS', 'HOUSEHOLD'], safety_standards: ['BPA_FREE'] },
  { sku: 'PLB-PP-2026-0007', name: 'Nắp flip-top 24/410', category_id: 'nắp-flip-top', material: 'PP', capacity_ml: null, height_mm: 25, body_dia_mm: null, neck_dia_mm: 24, weight_g: 4, color: 'WHITE', shape: 'ROUND', neck_type: 'SCREW', neck_spec: '24/410', unit_of_sale: 'PIECE', pcs_per_carton: 800, retail_price: 800, wholesale_price: 600, moq: 1000, industries: ['COSMETICS', 'FOOD'], safety_standards: ['FDA_FOOD_GRADE'] },
];

export async function seedProducts(prisma: PrismaClient, suppliers: Array<{ id: string }>) {
  for (const data of productsData) {
    const { industries, safety_standards, category_id, ...rest } = data;

    await prisma.product.upsert({
      where: { sku: data.sku },
      update: {},
      create: {
        sku: data.sku,
        name: data.name,
        category_id,
        material: rest.material as never,
        capacity_ml: rest.capacity_ml ?? undefined,
        height_mm: rest.height_mm,
        body_dia_mm: rest.body_dia_mm ?? undefined,
        neck_dia_mm: rest.neck_dia_mm ?? undefined,
        weight_g: rest.weight_g,
        color: rest.color as never,
        shape: rest.shape as never,
        neck_type: rest.neck_type as never,
        neck_spec: rest.neck_spec,
        unit_of_sale: rest.unit_of_sale as never,
        pcs_per_carton: rest.pcs_per_carton,
        retail_price: rest.retail_price ?? undefined,
        moq: rest.moq,
        industries: industries as never,
        safety_standards: safety_standards as never,
        price_tiers: {
          create: [
            { min_qty: 1, price: data.retail_price! },
            { min_qty: 500, price: Math.round(data.retail_price! * 0.9) },
            { min_qty: 1000, price: Math.round(data.retail_price! * 0.8) },
            { min_qty: 5000, price: Math.round(data.retail_price! * 0.7) },
          ],
        },
      },
    });

    // Link 2-3 suppliers per product with different prices
    const productSuppliers = suppliers.slice(0, Math.min(3, suppliers.length));
    for (let i = 0; i < productSuppliers.length; i++) {
      const basePrice = Math.round(data.retail_price! * 0.6);
      await prisma.supplierPrice.upsert({
        where: {
          supplier_id_product_id: {
            supplier_id: productSuppliers[i].id,
            product_id: data.sku,
          },
        },
        update: {},
        create: {
          supplier_id: productSuppliers[i].id,
          product_id: data.sku,
          purchase_price: Math.round(basePrice * (1 + i * 0.05)),
          moq: data.moq || 100,
          lead_time_days: 7 + i * 3,
          is_preferred: i === 0,
        },
      }).catch(() => { /* skip if product_id is sku not uuid */ });
    }
  }

  // Set up cap compatibilities
  // capCompatibility model removed from schema
}
