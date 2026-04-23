import { PrismaClient, Prisma } from '@prisma/client';
import { embedText, hashText, buildProductEmbeddingText } from '../src/lib/embedding';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { is_active: true },
    select: {
      id: true, name: true, description: true,
      material: true, capacity_ml: true, shape: true, color: true, custom_color: true,
      neck_type: true, neck_spec: true, industries: true,
    },
  });

  console.log(`Found ${products.length} active products\n`);

  let embedded = 0, skipped = 0, failed = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const text = buildProductEmbeddingText(p as any);
    const hash = hashText(text);

    // Check if already embedded with same hash
    const existing = await prisma.$queryRaw<{ embedding_hash: string | null }[]>`
      SELECT embedding_hash FROM products WHERE id = ${p.id}
    `;
    if (existing[0]?.embedding_hash === hash) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${products.length}] ${p.name.slice(0, 40)}... `);

    const vector = await embedText(text);
    if (!vector) {
      console.log('✗ embed failed');
      failed++;
      continue;
    }

    // Raw SQL to store vector (Prisma doesn't natively support pgvector)
    const vectorStr = `[${vector.join(',')}]`;
    await prisma.$executeRaw(Prisma.sql`
      UPDATE products
      SET embedding = ${vectorStr}::vector, embedding_hash = ${hash}
      WHERE id = ${p.id}
    `);

    console.log(`✓ dim=${vector.length}`);
    embedded++;

    // Rate-limit: Gemini free tier = 100 RPM (1 req / 0.6s to be safe)
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log(`\n=== Done: ${embedded} embedded, ${skipped} up-to-date, ${failed} failed ===`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
