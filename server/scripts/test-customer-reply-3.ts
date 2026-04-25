import { ChatbotService } from '../src/modules/ai/chatbot.service';

const cases: Array<{ label: string; history: any[]; q: string }> = [
  { label: 'Chào xã giao', history: [], q: 'chào bạn' },
  { label: 'Tư vấn chung', history: [], q: 'tôi muốn tư vấn' },
  { label: 'Khách có mục đích cụ thể', history: [], q: 'tôi cần đóng nước suối 500ml' },
  { label: 'Khách có mục đích mỹ phẩm', history: [], q: 'tôi cần lọ đựng serum' },
  { label: 'Hỏi có túi PE', history: [], q: 'có túi PE không em' },
  { label: 'Hỏi SP chung chung', history: [], q: 'bên mình có SP gì' },
  { label: 'Đắt thế', history: [
    { role: 'user', content: 'chai pet 500ml bao nhiêu' },
    { role: 'ai', content: 'Chai PET 500ml bên em 3.500đ/chai, MOQ 200 anh ạ.' },
  ], q: 'đắt quá' },
  { label: 'Lấy 3000', history: [
    { role: 'user', content: 'chai pet 500ml' },
    { role: 'ai', content: 'Có anh ạ, PET-500 3.500đ/chai MOQ 200.' },
  ], q: 'lấy 3000 chai thì sao' },
  { label: 'Hỏi có phải bot', history: [], q: 'em là người hay bot' },
  { label: 'Hỏi shop ở đâu', history: [], q: 'shop mình ở đâu' },
];

async function main() {
  for (const c of cases) {
    console.log(`\n━━━ ${c.label} ━━━`);
    if (c.history.length) {
      c.history.forEach((h: any) => console.log(`  ${h.role === 'user' ? 'Khách' : 'Em'}: ${h.content}`));
    }
    console.log(`Khách: ${c.q}`);
    const reply = await ChatbotService.customerReply(c.q, c.history);
    console.log(`Em: ${reply || '(empty)'}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
