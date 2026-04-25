import { ChatbotService } from '../src/modules/ai/chatbot.service';

const cases = [
  { q: 'chào bạn', h: [] },
  { q: 'bên mình có những sản phẩm gì nhỉ', h: [] },
  { q: 'có những dòng sản phẩm nào liên quan đến túi PE không', h: [] },
  { q: 'có bán nắp không', h: [] },
  { q: 'tôi cần chai PET 500ml', h: [] },
];

async function main() {
  for (const c of cases) {
    console.log(`\n--- Khách: ${c.q} ---`);
    const reply = await ChatbotService.customerReply(c.q, c.h as any);
    console.log(`Em: ${reply || '(empty)'}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
