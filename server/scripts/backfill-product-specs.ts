/**
 * Backfill product specs (technical, packaging, application) per product type.
 * - Detects type from name (Túi/Chai/Lọ/Can/Hũ/Nắp/Đầu bơm/Đầu xịt)
 * - Fills missing applicable fields with smart defaults
 * - Clears inapplicable fields (e.g. túi không có neck_*)
 *
 * Usage:
 *   tsx server/scripts/backfill-product-specs.ts            # dry-run
 *   tsx server/scripts/backfill-product-specs.ts --apply    # write to DB
 */
import prisma from '../src/lib/prisma';

const apply = process.argv.includes('--apply');

type ProductType = 'BAG' | 'BOTTLE' | 'CAN' | 'JAR' | 'CAP' | 'PUMP' | 'SPRAY' | 'OTHER';

function detectType(name: string): ProductType {
  const n = name.toLowerCase();
  if (n.startsWith('túi')) return 'BAG';
  if (n.startsWith('chai') || n.startsWith('lọ')) return 'BOTTLE';
  if (n.startsWith('can')) return 'CAN';
  if (n.startsWith('hũ')) return 'JAR';
  if (n.startsWith('đầu bơm')) return 'PUMP';
  if (n.startsWith('đầu xịt')) return 'SPRAY';
  if (n.startsWith('nắp')) return 'CAP';
  return 'OTHER';
}

// Fields applicable per type
const APPLICABLE: Record<ProductType, Set<string>> = {
  BOTTLE: new Set(['material','color','capacity_ml','height_mm','body_dia_mm','neck_dia_mm','weight_g','shape','neck_type','neck_spec','unit_of_sale','moq','pcs_per_carton','carton_weight','carton_length','carton_width','carton_height','industries','safety_standards']),
  CAN:    new Set(['material','color','capacity_ml','height_mm','body_dia_mm','neck_dia_mm','weight_g','shape','neck_type','neck_spec','unit_of_sale','moq','pcs_per_carton','carton_weight','carton_length','carton_width','carton_height','industries','safety_standards']),
  JAR:    new Set(['material','color','capacity_ml','height_mm','body_dia_mm','neck_dia_mm','weight_g','shape','neck_type','neck_spec','unit_of_sale','moq','pcs_per_carton','carton_weight','carton_length','carton_width','carton_height','industries','safety_standards']),
  BAG:    new Set(['material','color','weight_g','unit_of_sale','moq','pcs_per_carton','carton_weight','carton_length','carton_width','carton_height','industries','safety_standards']),
  CAP:    new Set(['material','color','height_mm','neck_dia_mm','weight_g','neck_type','neck_spec','shape','unit_of_sale','moq','pcs_per_carton','carton_weight','carton_length','carton_width','carton_height','industries','safety_standards']),
  PUMP:   new Set(['material','color','height_mm','neck_dia_mm','weight_g','neck_type','neck_spec','shape','unit_of_sale','moq','pcs_per_carton','carton_weight','carton_length','carton_width','carton_height','industries','safety_standards']),
  SPRAY:  new Set(['material','color','height_mm','neck_dia_mm','weight_g','neck_type','neck_spec','shape','unit_of_sale','moq','pcs_per_carton','carton_weight','carton_length','carton_width','carton_height','industries','safety_standards']),
  OTHER:  new Set(),
};

// Smart defaults
function defaultBodyDia(capacity_ml?: number | null): number {
  if (!capacity_ml) return 50;
  if (capacity_ml <= 100) return 42;
  if (capacity_ml <= 200) return 50;
  if (capacity_ml <= 350) return 58;
  if (capacity_ml <= 600) return 65;
  if (capacity_ml <= 1100) return 80;
  if (capacity_ml <= 1600) return 90;
  if (capacity_ml <= 5500) return 160;
  return 230;
}

function defaultNeckDia(neck_spec?: string | null): number | null {
  if (!neck_spec) return null;
  const m = neck_spec.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function defaultCarton(type: ProductType, capacity_ml?: number | null): { pcs: number; len: number; wid: number; hgt: number; weight: number } {
  if (type === 'CAP' || type === 'PUMP' || type === 'SPRAY') return { pcs: 1000, len: 400, wid: 300, hgt: 250, weight: 8 };
  if (type === 'BAG') return { pcs: 1000, len: 500, wid: 350, hgt: 300, weight: 10 };
  const c = capacity_ml || 500;
  if (c <= 200) return { pcs: 200, len: 400, wid: 300, hgt: 280, weight: 7 };
  if (c <= 600) return { pcs: 100, len: 450, wid: 350, hgt: 320, weight: 8 };
  if (c <= 1100) return { pcs: 48, len: 480, wid: 360, hgt: 360, weight: 10 };
  if (c <= 1600) return { pcs: 24, len: 500, wid: 380, hgt: 400, weight: 12 };
  if (c <= 5500) return { pcs: 12, len: 600, wid: 450, hgt: 420, weight: 18 };
  return { pcs: 4, len: 800, wid: 600, hgt: 450, weight: 25 };
}

function defaultIndustries(name: string, type: ProductType, material: string | null): string[] {
  const n = name.toLowerCase();
  const inds = new Set<string>();
  if (n.includes('hóa chất') || n.includes('hoá chất') || n.includes('công nghiệp')) inds.add('CHEMICAL');
  if (n.includes('mỹ phẩm') || n.includes('serum') || n.includes('xịt sương')) inds.add('COSMETICS');
  if (n.includes('thực phẩm') || n.includes('gia vị') || n.includes('nước') || n.includes('giải khát') || n.includes('khoáng') || n.includes('suối')) inds.add('FOOD');
  if (n.includes('dược') || n.includes('y tế')) inds.add('PHARMA');
  if (n.includes('gia dụng')) inds.add('HOUSEHOLD');
  if (inds.size === 0) {
    if (type === 'BOTTLE' && material === 'PET') { inds.add('FOOD'); inds.add('COSMETICS'); }
    else if (type === 'CAN' && material === 'HDPE') { inds.add('CHEMICAL'); inds.add('HOUSEHOLD'); }
    else if (type === 'JAR' && material === 'PP') { inds.add('FOOD'); inds.add('COSMETICS'); }
    else if (type === 'BAG') { inds.add('FOOD'); inds.add('HOUSEHOLD'); }
    else if (type === 'CAP' || type === 'PUMP' || type === 'SPRAY') { inds.add('COSMETICS'); inds.add('FOOD'); }
  }
  return Array.from(inds);
}

function defaultStandards(name: string, type: ProductType, material: string | null, industries: string[]): string[] {
  const stds = new Set<string>();
  if (industries.includes('FOOD') || industries.includes('PHARMA')) stds.add('FDA_FOOD_GRADE');
  if (material === 'PET' || material === 'PP' || material === 'HDPE') stds.add('BPA_FREE');
  if (type === 'CAN' && industries.includes('CHEMICAL')) stds.delete('FDA_FOOD_GRADE');
  if (name.toLowerCase().includes('hóa chất') || name.toLowerCase().includes('hoá chất')) stds.delete('FDA_FOOD_GRADE');
  return Array.from(stds);
}

async function main() {
  const products = await prisma.product.findMany({ orderBy: { sku: 'asc' } });
  console.log(`Found ${products.length} products. Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

  let updated = 0;
  for (const p of products) {
    const type = detectType(p.name);
    const allowed = APPLICABLE[type];
    const updates: Record<string, unknown> = {};
    const cleared: string[] = [];

    // 1) Clear inapplicable fields
    const techFields = ['capacity_ml','height_mm','body_dia_mm','neck_dia_mm','shape','neck_type','neck_spec'];
    for (const f of techFields) {
      if (!allowed.has(f) && (p as any)[f] !== null && (p as any)[f] !== undefined) {
        updates[f] = null;
        cleared.push(f);
      }
    }

    // 2) Fill missing applicable fields
    if (allowed.has('body_dia_mm') && p.body_dia_mm == null) {
      updates.body_dia_mm = defaultBodyDia(p.capacity_ml);
    }
    if (allowed.has('neck_dia_mm') && p.neck_dia_mm == null) {
      const nd = defaultNeckDia(p.neck_spec);
      if (nd) updates.neck_dia_mm = nd;
    }
    if (allowed.has('shape') && !p.shape && (type === 'BOTTLE' || type === 'JAR' || type === 'CAP' || type === 'PUMP' || type === 'SPRAY')) {
      updates.shape = 'ROUND';
    }
    const carton = defaultCarton(type, p.capacity_ml);
    if (allowed.has('pcs_per_carton') && p.pcs_per_carton == null) updates.pcs_per_carton = carton.pcs;
    if (allowed.has('carton_length') && p.carton_length == null) updates.carton_length = carton.len;
    if (allowed.has('carton_width') && p.carton_width == null) updates.carton_width = carton.wid;
    if (allowed.has('carton_height') && p.carton_height == null) updates.carton_height = carton.hgt;
    if (allowed.has('carton_weight') && p.carton_weight == null) updates.carton_weight = carton.weight;

    // industries / safety_standards (Postgres arrays — empty array means unset)
    if (allowed.has('industries') && (!p.industries || p.industries.length === 0)) {
      updates.industries = defaultIndustries(p.name, type, p.material) as never;
    }
    const finalIndustries = (updates.industries as string[] | undefined) ?? p.industries;
    if (allowed.has('safety_standards') && (!p.safety_standards || p.safety_standards.length === 0)) {
      updates.safety_standards = defaultStandards(p.name, type, p.material, finalIndustries) as never;
    }

    if (Object.keys(updates).length === 0) continue;

    console.log(`[${p.sku}] ${p.name}  (${type})`);
    if (cleared.length) console.log(`  cleared: ${cleared.join(', ')}`);
    for (const [k, v] of Object.entries(updates)) {
      if (cleared.includes(k)) continue;
      console.log(`  ${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`);
    }
    console.log();

    if (apply) {
      await prisma.product.update({ where: { id: p.id }, data: updates });
    }
    updated++;
  }

  console.log(`\n${updated} products ${apply ? 'updated' : 'would be updated'}.`);
  if (!apply) console.log('Re-run with --apply to write changes.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
