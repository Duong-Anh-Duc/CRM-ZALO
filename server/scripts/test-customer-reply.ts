/**
 * Thử nghiệm giọng điệu customerReply (auto-reply Zalo).
 * Chạy: yarn tsx scripts/test-customer-reply.ts
 */
import fs from 'fs';
import path from 'path';
import { ChatbotService } from '../src/modules/ai/chatbot.service';
import { uploadImage } from '../src/lib/cloudinary';

const scenarios: Array<{ label: string; history: { role: string; content: string }[]; question: string }> = [
  {
    label: '1. Chào xã giao',
    history: [],
    question: 'chào bạn',
  },
  {
    label: '2. Muốn tư vấn chung',
    history: [],
    question: 'tôi muốn tư vấn',
  },
  {
    label: '3. Hỏi SP cụ thể (có tra giá)',
    history: [],
    question: 'chai pet 500ml bao nhiêu một chai vậy em?',
  },
  {
    label: '4. Phàn nàn giá',
    history: [
      { role: 'user', content: 'chai pet 500ml bao nhiêu vậy em?' },
      { role: 'assistant', content: 'Dạ chai PET 500ml bên em 2.500đ/chai ạ' },
    ],
    question: 'đắt thế',
  },
  {
    label: '5. Hỏi còn hàng',
    history: [],
    question: 'còn hàng không em',
  },
  {
    label: '6. Hỏi shop ở đâu',
    history: [],
    question: 'shop mình ở đâu vậy',
  },
  {
    label: '7. Hỏi có phải bot',
    history: [],
    question: 'em là người hay bot vậy',
  },
  {
    label: '8. Kịch bản tiếp: đã tư vấn SP xong, khách muốn đặt',
    history: [
      { role: 'user', content: 'chai pet 500ml bao nhiêu em' },
      { role: 'assistant', content: 'Dạ chai PET 500ml bên em 2.500đ/chai, MOQ 1000 chai anh ạ. Giá này tham khảo thôi, lấy nhiều mình có giá tốt hơn.' },
    ],
    question: 'vậy tôi đặt 5000 chai thì sao',
  },
  {
    label: '9. Khách hỏi mơ hồ',
    history: [],
    question: 'cái nắp kia',
  },
  {
    label: '10. Khách cảm ơn cuối hội thoại',
    history: [
      { role: 'user', content: 'chai pet 500ml bao nhiêu' },
      { role: 'assistant', content: 'Dạ 2.500đ/chai ạ' },
      { role: 'user', content: 'ok để tôi xem đã' },
      { role: 'assistant', content: 'Dạ anh cứ xem thoải mái, có gì nhắn em tư vấn thêm ạ' },
    ],
    question: 'cảm ơn em nhé',
  },
];

async function main() {
  console.log('===== TEST GIỌNG ĐIỆU customerReply =====\n');
  for (const s of scenarios) {
    console.log(`\n--- ${s.label} ---`);
    if (s.history.length > 0) {
      console.log('[Lịch sử]:');
      s.history.forEach((h) => console.log(`  ${h.role === 'user' ? 'Khách' : 'Em'}: ${h.content}`));
    }
    console.log(`Khách: ${s.question}`);
    try {
      const reply = await ChatbotService.customerReply(s.question, s.history);
      console.log(`Em: ${reply || '(empty)'}`);
    } catch (err: any) {
      console.log(`❌ Error: ${err?.message || err}`);
    }
  }

  // Image test: túi PE 4060
  const imgPath = path.join(__dirname, '..', 'images', 'tuipe4060.jpg');
  if (fs.existsSync(imgPath)) {
    console.log('\n--- 11. Gửi ảnh túi PE 40x60 hỏi "có không" ---');
    console.log('Uploading image to Cloudinary...');
    const buf = fs.readFileSync(imgPath);
    const uploaded = await uploadImage(buf, 'packflow/test');
    console.log(`  URL: ${uploaded.secure_url}`);
    console.log('Khách: [ảnh] có không em?');
    const reply = await ChatbotService.customerReply(
      'có không em',
      [],
      undefined,
      [uploaded.secure_url],
    );
    console.log(`Em: ${reply || '(empty)'}`);
  } else {
    console.log('\n(Không tìm thấy file ảnh để test image)');
  }

  console.log('\n===== DONE =====');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
