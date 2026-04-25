/**
 * Test Aura chatbot export commands end-to-end.
 */
import { ChatbotService } from '../src/modules/ai/chatbot.service';

async function run(question: string) {
  console.log(`\n━━━ "${question}" ━━━`);
  let full = '';
  for await (const chunk of ChatbotService.chatStream(question, [])) {
    full += chunk;
  }
  console.log(full);
}

async function main() {
  await run('xuất danh sách khách hàng ra excel');
  await run('xuất SP đang hoạt động chất liệu PET');
  await run('xuất NCC còn công nợ');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
