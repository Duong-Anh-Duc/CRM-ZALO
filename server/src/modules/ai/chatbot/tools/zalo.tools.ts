import dayjs from 'dayjs';
import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const zaloTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'get_zalo_messages',
        description: 'Đọc tin nhắn Zalo đã sync (incoming + outgoing) từ DB. Lọc theo thời gian (hôm nay/tuần này/khoảng ngày), theo tên, sender_id hoặc group_id. Dùng khi user hỏi "tin nhắn zalo hôm nay", "tôi có nhắn với {tên} không", "tóm tắt hội thoại với {tên}".',
        parameters: {
          type: 'object',
          properties: {
            range: { type: 'string', enum: ['today', 'yesterday', 'week', 'month', 'all', 'custom'], description: 'Khoảng thời gian — mặc định "all" nếu hỏi "tôi có nhắn với ai không"' },
            from_date: { type: 'string', description: 'YYYY-MM-DD (dùng khi range=custom)' },
            to_date: { type: 'string', description: 'YYYY-MM-DD (dùng khi range=custom)' },
            search: { type: 'string', description: 'Tìm theo TÊN người gửi (sender_name) hoặc NỘI DUNG tin nhắn — case-insensitive. Ưu tiên khi user hỏi theo tên như "Trần Trung Kiên"' },
            sender_id: { type: 'string', description: 'Lọc theo 1 user_id cụ thể (nếu biết chính xác)' },
            group_id: { type: 'string', description: 'Lọc theo 1 group_id cụ thể' },
            direction: { type: 'string', enum: ['INCOMING', 'OUTGOING', 'ALL'], description: 'Mặc định ALL' },
            limit: { type: 'number', description: 'Số tin tối đa (mặc định 100, max 300)' },
          },
        },
      },
    },
    handler: async (args) => {
      const now = dayjs();
      let start: dayjs.Dayjs | null = null;
      let end: dayjs.Dayjs | null = null;
      switch (args.range || 'today') {
        case 'today':     start = now.startOf('day');       end = now.endOf('day'); break;
        case 'yesterday': start = now.subtract(1, 'day').startOf('day'); end = now.subtract(1, 'day').endOf('day'); break;
        case 'week':      start = now.startOf('week');      end = now.endOf('week'); break;
        case 'month':     start = now.startOf('month');     end = now.endOf('month'); break;
        case 'all':       break;
        case 'custom':
          if (args.from_date) start = dayjs(args.from_date).startOf('day');
          if (args.to_date)   end = dayjs(args.to_date).endOf('day');
          break;
      }
      const where: any = {};
      if (start) where.created_at = { gte: start.toDate() };
      if (end)   where.created_at = { ...(where.created_at || {}), lte: end.toDate() };
      if (args.sender_id) where.sender_id = args.sender_id;
      if (args.group_id)  where.group_id = args.group_id;
      if (args.direction && args.direction !== 'ALL') where.direction = args.direction;
      if (args.search) {
        where.OR = [
          { sender_name: { contains: args.search, mode: 'insensitive' } },
          { content: { contains: args.search, mode: 'insensitive' } },
        ];
      }
      const limit = Math.min(args.limit ?? 100, 300);
      const msgs = await prisma.zaloMessage.findMany({
        where, orderBy: { created_at: 'desc' }, take: limit,
        select: { id: true, direction: true, sender_id: true, sender_name: true, group_id: true, content: true, msg_type: true, created_at: true },
      });
      if (msgs.length === 0) {
        return args.search
          ? `Không tìm thấy tin nhắn nào khớp "${args.search}".`
          : 'Không có tin nhắn Zalo nào trong khoảng này.';
      }
      return msgs.reverse().map((m) => {
        const t = dayjs(m.created_at).format('DD/MM HH:mm');
        const who = m.direction === 'OUTGOING' ? '→ shop' : `← ${m.sender_name || m.sender_id?.slice(0, 8) || '?'}`;
        const loc = m.group_id ? ` [group:${m.group_id.slice(0, 8)}]` : '';
        const content = (m.content || '').replace(/\n/g, ' ').slice(0, 280);
        return `${t} ${who}${loc}: ${content}`;
      }).join('\n');
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'list_zalo_threads',
        description: 'Liệt kê các hội thoại Zalo (distinct sender_id/group_id) kèm last message + số tin. Có thể tìm theo tên người chat. Dùng khi user hỏi "tôi có nhắn với {tên} không", "có ai nhắn chưa rep", "danh sách khách đang chat".',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['user', 'group', 'all'], description: 'Mặc định all' },
            search: { type: 'string', description: 'Tìm theo TÊN người/nhóm (sender_name) — case-insensitive. VD "Trần Trung Kiên"' },
            limit: { type: 'number', description: 'Mặc định 20' },
            since_days: { type: 'number', description: 'Chỉ lấy thread có hoạt động trong N ngày (mặc định 30, dùng 365 nếu muốn tìm toàn bộ)' },
          },
        },
      },
    },
    handler: async (args) => {
      const sinceDays = args.since_days ?? 30;
      const since = dayjs().subtract(sinceDays, 'day').toDate();
      const where: any = { created_at: { gte: since } };
      if (args.type === 'user')  where.group_id = null;
      if (args.type === 'group') where.group_id = { not: null };
      if (args.search) {
        where.sender_name = { contains: args.search, mode: 'insensitive' };
      }
      const msgs = await prisma.zaloMessage.findMany({
        where, orderBy: { created_at: 'desc' },
        select: { sender_id: true, sender_name: true, recipient_id: true, group_id: true, direction: true, content: true, created_at: true },
      });
      const threads = new Map<string, { key: string; name: string; is_group: boolean; last_at: Date; last_content: string; last_direction: string; incoming: number; total: number }>();
      for (const m of msgs) {
        const key = m.group_id
          ? m.group_id
          : (m.direction === 'INCOMING' ? m.sender_id : (m.recipient_id || m.sender_id));
        if (!key) continue;
        if (!threads.has(key)) {
          threads.set(key, {
            key,
            name: m.sender_name || (m.group_id ? `Group ${key.slice(0, 8)}` : `User ${key.slice(0, 8)}`),
            is_group: Boolean(m.group_id),
            last_at: m.created_at,
            last_content: m.content || '',
            last_direction: m.direction,
            incoming: 0,
            total: 0,
          });
        }
        const t = threads.get(key)!;
        t.total++;
        if (m.direction === 'INCOMING') t.incoming++;
      }
      const limit = args.limit ?? 20;
      const list = [...threads.values()].sort((a, b) => b.last_at.getTime() - a.last_at.getTime()).slice(0, limit);
      if (list.length === 0) {
        return args.search
          ? `Không tìm thấy thread Zalo nào có tên chứa "${args.search}" trong ${sinceDays} ngày qua.`
          : `Không có thread Zalo hoạt động trong ${sinceDays} ngày qua.`;
      }
      return list.map((t, i) => {
        const dir = t.last_direction === 'OUTGOING' ? '→' : '←';
        const time = dayjs(t.last_at).format('DD/MM HH:mm');
        const tag = t.is_group ? '[GROUP]' : '[DM]';
        return `${i + 1}. ${tag} ${t.name} [key:${t.key}] | ${t.total} tin (${t.incoming} đến) | ${time} ${dir} ${(t.last_content || '').slice(0, 80)}`;
      }).join('\n');
    },
  },
  {
    audit: true,
    schema: {
      type: 'function',
      function: {
        name: 'send_zalo_message',
        description: 'Gửi tin nhắn tới 1 user Zalo (DM). Cần user_id (sender_id của Zalo). Nếu user nói theo TÊN ("nhắn cho Trần Trung Kiên là X"), TRƯỚC KHI GỬI phải:\n1. Gọi list_zalo_threads(search:"tên") để tìm sender_id, HOẶC search_customer/search_supplier(query:"tên") để lấy zalo_user_id.\n2. CÓ user_id → gọi tool NGAY, không hỏi lại. Nếu user đã nói đủ nội dung (VD "nhắn là chào em") thì GỬI LUÔN.\n3. Chỉ hỏi lại khi: tìm thấy >1 người cùng tên (ambiguous), hoặc user_id KHÔNG tìm được.\n4. Sau khi tool trả về thành công, báo lại ngắn gọn. KHÔNG hỏi "anh cần thêm gì không" — dư thừa.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'sender_id/user_id Zalo' },
            content: { type: 'string', description: 'Nội dung tin nhắn' },
          },
          required: ['user_id', 'content'],
        },
      },
    },
    handler: async (args) => {
      if (!args.user_id || !args.content) return '❌ Thiếu user_id hoặc content';
      const asIncomingSender = await prisma.zaloMessage.count({
        where: { sender_id: args.user_id, direction: 'INCOMING', group_id: null },
      });
      const asRecipient = await prisma.zaloMessage.count({
        where: { recipient_id: args.user_id, direction: 'OUTGOING' },
      });
      if (asIncomingSender === 0 && asRecipient === 0) {
        return `❌ user_id=${args.user_id} không tìm thấy trong lịch sử chat (không phải INCOMING sender, không phải OUTGOING recipient). Có thể đây là user_id của SHOP. Vui lòng dùng list_zalo_threads(search:"tên") để lấy partner user_id đúng.`;
      }
      const nameRow = await prisma.zaloMessage.findFirst({
        where: {
          OR: [
            { sender_id: args.user_id, direction: 'INCOMING' },
            { recipient_id: args.user_id, direction: 'OUTGOING' },
          ],
          sender_name: { not: null },
        },
        orderBy: { created_at: 'desc' },
        select: { sender_name: true },
      });
      const name = nameRow?.sender_name || args.user_id;
      const { ZaloService } = await import('../../../zalo/zalo.service');
      const result = await ZaloService.sendMessage(args.user_id, args.content);
      const msgId = result?.data?.msg_id || result?.msg_id || 'n/a';
      return `✅ Đã gửi đến "${name}" (user_id=${args.user_id}, msg_id=${msgId}). Nội dung: "${args.content}"`;
    },
  },
  {
    audit: true,
    schema: {
      type: 'function',
      function: {
        name: 'send_zalo_group_message',
        description: 'Gửi tin nhắn vào group Zalo. Dùng khi user ra lệnh "nhắn vào nhóm {group} là ...". HỎI USER XÁC NHẬN trước khi gửi.',
        parameters: {
          type: 'object',
          properties: {
            group_id: { type: 'string', description: 'Zalo group_id' },
            content: { type: 'string', description: 'Nội dung tin nhắn' },
          },
          required: ['group_id', 'content'],
        },
      },
    },
    handler: async (args) => {
      if (!args.group_id || !args.content) return '❌ Thiếu group_id hoặc content';
      const { ZaloService } = await import('../../../zalo/zalo.service');
      const result = await ZaloService.groupSendMessage(args.group_id, args.content);
      const msgId = result?.data?.msg_id || result?.msg_id || 'n/a';
      return `✅ Đã gửi vào group (group_id=${args.group_id}, msg_id=${msgId}). Nội dung: "${args.content}"`;
    },
  },
  {
    audit: true,
    schema: {
      type: 'function',
      function: {
        name: 'set_zalo_auto_reply',
        description: 'Bật/tắt auto-reply AI cho 1 thread Zalo cụ thể (thread_key = sender_id với DM, group_id với group). Dùng khi user ra lệnh "tắt bot cho {khách/group}", "bật auto-reply cho ...".',
        parameters: {
          type: 'object',
          properties: {
            thread_key: { type: 'string', description: 'sender_id (DM) hoặc group_id' },
            enabled: { type: 'boolean', description: 'true để bật, false để tắt' },
          },
          required: ['thread_key', 'enabled'],
        },
      },
    },
    handler: async (args) => {
      if (!args.thread_key || typeof args.enabled !== 'boolean') return '❌ Thiếu thread_key hoặc enabled';
      const thread = await prisma.zaloThread.upsert({
        where: { thread_key: args.thread_key },
        update: { auto_reply_enabled: args.enabled },
        create: { thread_key: args.thread_key, auto_reply_enabled: args.enabled },
      });
      return `✅ Đã ${args.enabled ? 'BẬT' : 'TẮT'} auto-reply cho thread ${thread.thread_key}`;
    },
  },
];
