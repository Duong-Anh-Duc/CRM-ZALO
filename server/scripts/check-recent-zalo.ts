import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const recent = await prisma.zaloMessage.findMany({
    where: { created_at: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    orderBy: { created_at: 'desc' },
    take: 15,
  });
  console.log('Recent Zalo messages (last 10 min):');
  for (const m of recent) {
    const arrow = m.direction === 'INCOMING' ? '→' : '←';
    const time = m.created_at.toISOString().substring(11, 19);
    const who = m.direction === 'INCOMING' ? (m.sender_name || m.sender_id) : 'BOT';
    console.log(`  [${time}] ${arrow} ${who}: ${(m.content||'').substring(0,100)}  (${m.event}/${m.status})`);
  }
  if (recent.length === 0) console.log('  (no messages in last 10 min)');
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); });
