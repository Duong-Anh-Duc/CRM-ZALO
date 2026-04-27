/**
 * Backfill products.description from product specs.
 *
 * Usage:
 *   tsx server/scripts/backfill-product-descriptions.ts            # dry-run (preview)
 *   tsx server/scripts/backfill-product-descriptions.ts --apply    # write to DB
 *   tsx server/scripts/backfill-product-descriptions.ts --apply --force  # overwrite existing descriptions
 *
 * Default: only fills products with empty description.
 */
import prisma from '../src/lib/prisma';

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');

const colorVi: Record<string, string> = { TRANSPARENT: 'trong suốt', WHITE: 'trắng', CUSTOM: '' };
const shapeVi: Record<string, string> = { ROUND: 'tròn', SQUARE: 'vuông', OVAL: 'oval', FLAT: 'dẹt' };
const neckVi: Record<string, string> = { WIDE: 'rộng', NARROW: 'hẹp', PUMP: 'pump', SPRAY: 'spray', SCREW: 'van xoay' };
const industryVi: Record<string, string> = { FOOD: 'thực phẩm', COSMETICS: 'mỹ phẩm', CHEMICAL: 'hóa chất', PHARMA: 'dược phẩm', HOUSEHOLD: 'đồ gia dụng' };
const safetyVi: Record<string, string> = { FDA_FOOD_GRADE: 'FDA food grade', BPA_FREE: 'không chứa BPA', ISO: 'ISO' };
const unitVi: Record<string, string> = { PIECE: 'cái', CARTON: 'thùng', KG: 'kg' };

function joinClauses(parts: string[]): string {
  const filtered = parts.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  return filtered.slice(0, -1).join(', ') + ' và ' + filtered[filtered.length - 1];
}

function buildDescription(p: any): string {
  const sentences: string[] = [];

  // Sentence 1: name + material
  let opener = p.name;
  if (p.material) opener += ` chất liệu ${p.material}`;
  if (p.color) {
    const c = p.color === 'CUSTOM' ? (p.custom_color || '') : colorVi[p.color];
    if (c) opener += `, màu ${c}`;
  }
  sentences.push(opener);

  // Sentence 2: technical dims
  const dims: string[] = [];
  if (p.capacity_ml) dims.push(`dung tích ${p.capacity_ml}ml`);
  if (p.height_mm) dims.push(`chiều cao ${p.height_mm}mm`);
  if (p.body_dia_mm) dims.push(`đường kính thân ${p.body_dia_mm}mm`);
  if (p.neck_dia_mm) dims.push(`đường kính cổ ${p.neck_dia_mm}mm`);
  if (p.weight_g) dims.push(`trọng lượng ${p.weight_g}g`);
  if (dims.length) sentences.push('Thông số: ' + joinClauses(dims));

  // Sentence 3: shape + neck
  const form: string[] = [];
  if (p.shape) form.push(`hình dạng ${shapeVi[p.shape] || p.shape.toLowerCase()}`);
  if (p.neck_type) {
    const nt = `cổ ${neckVi[p.neck_type] || p.neck_type.toLowerCase()}`;
    form.push(p.neck_spec ? `${nt} ${p.neck_spec}` : nt);
  }
  if (form.length) sentences.push('Thiết kế ' + joinClauses(form));

  // Sentence 4: industries
  if (p.industries?.length) {
    const inds = p.industries.map((i: string) => industryVi[i] || i.toLowerCase());
    sentences.push(`Phù hợp cho ngành ${joinClauses(inds)}`);
  }

  // Sentence 5: safety
  if (p.safety_standards?.length) {
    const stds = p.safety_standards.map((s: string) => safetyVi[s] || s);
    sentences.push(`Đạt chuẩn ${joinClauses(stds)}`);
  }

  // Sentence 6: packaging
  const pack: string[] = [];
  const unit = unitVi[p.unit_of_sale] || 'cái';
  if (p.moq) pack.push(`MOQ ${p.moq.toLocaleString('vi')} ${unit}`);
  if (p.pcs_per_carton) pack.push(`đóng ${p.pcs_per_carton.toLocaleString('vi')} ${unit}/thùng`);
  if (p.carton_length && p.carton_width && p.carton_height) {
    pack.push(`thùng ${p.carton_length}x${p.carton_width}x${p.carton_height}mm`);
  }
  if (p.carton_weight) pack.push(`thùng nặng ${p.carton_weight}kg`);
  if (pack.length) sentences.push('Đóng gói: ' + joinClauses(pack));

  return sentences.map(s => s.endsWith('.') ? s : s + '.').join(' ');
}

async function main() {
  const products = await prisma.product.findMany({
    orderBy: { sku: 'asc' },
    select: {
      id: true, sku: true, name: true, description: true,
      material: true, capacity_ml: true, height_mm: true, body_dia_mm: true, neck_dia_mm: true, weight_g: true,
      color: true, custom_color: true, shape: true, neck_type: true, neck_spec: true,
      unit_of_sale: true, moq: true, pcs_per_carton: true, carton_weight: true,
      carton_length: true, carton_width: true, carton_height: true,
      industries: true, safety_standards: true,
    },
  });

  console.log(`Found ${products.length} products. Mode: ${apply ? 'APPLY' : 'DRY-RUN'}${force ? ' (force overwrite)' : ' (skip non-empty)'}\n`);

  let updated = 0;
  let skipped = 0;
  for (const p of products) {
    const hasExisting = (p.description || '').trim().length > 0;
    if (hasExisting && !force) {
      skipped++;
      continue;
    }
    const desc = buildDescription(p);
    console.log(`[${p.sku}] ${p.name}`);
    console.log(`  → ${desc}\n`);
    if (apply) {
      await prisma.product.update({ where: { id: p.id }, data: { description: desc } });
    }
    updated++;
  }

  console.log(`\nDone. ${updated} ${apply ? 'updated' : 'would be updated'}, ${skipped} skipped (already have description).`);
  if (!apply) console.log('Re-run with --apply to write changes.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
