/**
 * RBAC migration script — Phase 1.
 *
 * Flow:
 *   1. Seed Role/Permission tables via seedRBAC().
 *   2. Backfill User.role_id from any legacy `role` enum column that still
 *      exists on the `users` table (ADMIN → admin, STAFF → sales,
 *      VIEWER → viewer). Runs via raw SQL so it is safe whether the old
 *      column is present or not.
 *   3. Ensure every user has a role_id (fall back to the `sales` role).
 *
 * Usage:
 *   npx tsx scripts/migrate-to-rbac.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedRBAC } from '../src/prisma/seeds/rbac';

const prisma = new PrismaClient();

const LEGACY_MAP: Record<string, string> = {
  ADMIN: 'admin',
  STAFF: 'sales',
  VIEWER: 'viewer',
};

async function main(): Promise<void> {
  console.log('▶ RBAC migration starting...');

  await seedRBAC(prisma);

  const roles = await prisma.role.findMany();
  const bySlug = new Map(roles.map((r) => [r.slug, r]));

  const legacyColumnExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'role'
     ) AS exists`
  );
  const hasLegacy = legacyColumnExists[0]?.exists === true;

  if (hasLegacy) {
    console.log('  • Legacy "role" column detected — backfilling role_id from enum values.');
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; role: string | null }>>(
      `SELECT id, role::text AS role FROM users WHERE role_id IS NULL`
    );
    for (const row of rows) {
      const slug = row.role ? LEGACY_MAP[row.role] : undefined;
      const target = slug ? bySlug.get(slug) : undefined;
      if (!target) continue;
      await prisma.user.update({ where: { id: row.id }, data: { role_id: target.id } });
    }
    console.log(`  • Backfilled ${rows.length} user rows from legacy column.`);
  } else {
    console.log('  • No legacy "role" column — skipping enum backfill.');
  }

  // Safety net: any user still without a role gets "sales".
  // Uses raw SQL because in the final schema `role_id` is non-nullable and
  // the Prisma client refuses to build a `{ role_id: null }` filter.
  const fallback = bySlug.get('sales');
  if (fallback) {
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE users SET role_id = $1 WHERE role_id IS NULL`,
      fallback.id,
    );
    if (updated > 0) {
      console.log(`  • Assigned fallback "sales" role to ${updated} user(s) with no role.`);
    }
  }

  console.log('✅ RBAC migration complete.');
}

main()
  .catch((err) => {
    console.error('❌ RBAC migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
