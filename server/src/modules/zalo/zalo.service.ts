import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import logger from '../../utils/logger';
import axios from 'axios';
import { ZaloOrderService } from './zalo-order.service';
import { AIService } from '../ai/ai.service';

export class ZaloService {
  // ──── Config ────

  private static async getActiveConfig() {
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true }, orderBy: { updated_at: 'desc' } });
    if (!cfg) throw new AppError(t('zalo.configNotFound'), 400);
    return cfg;
  }

  static async getConfig() {
    return prisma.zaloConfig.findFirst({ orderBy: { updated_at: 'desc' } });
  }

  static async saveConfig(data: Record<string, unknown>) {
    const existing = await prisma.zaloConfig.findFirst();
    if (existing) {
      return prisma.zaloConfig.update({ where: { id: existing.id }, data: { ...data, is_active: true } as any });
    }
    return prisma.zaloConfig.create({ data: data as any });
  }

  // ──── Helper: call Func.vn API ────

  private static async callFunc(url: string, token: string, body: Record<string, unknown>) {
    try {
      const response = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        timeout: 30000,
      });
      return response.data;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
      logger.error(`Func.vn API error: ${msg}`, { url, status: err.response?.status });
      throw new AppError(`Func.vn: ${msg}`, err.response?.status || 500);
    }
  }

  // ──── 1. FUNC_GET_THREADS ────

  static async getThreads(limit: number = 50, type?: string) {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_threads_url || !cfg.get_threads_token) throw new AppError(t('zalo.configNotFound'), 400);

    const result = await this.callFunc(cfg.get_threads_url, cfg.get_threads_token, { limit });
    let threads = result?.data || [];

    if (type === 'personal') {
      threads = threads.filter((th: any) => th.type === 'PRIVATE_MESSAGING' && th.last_content);
    } else if (type === 'group') {
      threads = threads.filter((th: any) => th.type === 'GROUP_MESSAGING');
    }

    // Sort by last_content_at descending
    threads.sort((a: any, b: any) => {
      const ta = a.last_content_at || a.updated_at || a.created_at;
      const tb = b.last_content_at || b.updated_at || b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    return threads;
  }

  // ──── 2. FUNC_GET_MESSAGES ────

  static async getMessagesByContact(contact_pid: string, limit: number = 50) {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_messages_url || !cfg.get_messages_token) throw new AppError(t('zalo.configNotFound'), 400);

    const result = await this.callFunc(cfg.get_messages_url, cfg.get_messages_token, { contact_pid, limit });
    return result?.data || [];
  }

  // ──── 3. GET_GROUP_INFO ────

  static async getGroupInfo(group_id: string) {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_group_info_url || !cfg.get_group_info_token) throw new AppError(t('zalo.configNotFound'), 400);

    const result = await this.callFunc(cfg.get_group_info_url, cfg.get_group_info_token, { group_id });
    const data = result?.data?.data?.gridInfoMap || {};
    const info = Object.values(data)[0] || null;
    return info;
  }

  // ──── 4. GET_USER_INFO_V2 ────

  static async getUserInfo(user_id: string) {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_user_info_url || !cfg.get_user_info_token) throw new AppError(t('zalo.configNotFound'), 400);

    const result = await this.callFunc(cfg.get_user_info_url, cfg.get_user_info_token, { user_id, phone_number: '' });
    const profiles = result?.data?.data?.changed_profiles || {};
    const info = Object.values(profiles)[0] || null;
    return info;
  }

  // ──── 5. GET_USER_INFO_EXTRA ────

  static async getUserInfoExtra(user_id: string) {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_user_extra_url || !cfg.get_user_extra_token) throw new AppError(t('zalo.configNotFound'), 400);

    const result = await this.callFunc(cfg.get_user_extra_url, cfg.get_user_extra_token, { user_id, phone_number: '' });
    return result?.data || null;
  }

  // ──── Webhook ────

  static async handleWebhook(payload: any) {
    try {
      const event = payload?.payload?.event || payload?.event || 'UNKNOWN';
      const platform = payload?.payload?.platform || payload?.platform || 'ZALO_USER';
      const accountId = payload?.payload?.account_id || payload?.account_id || '';
      const data = payload?.payload?.data?.data || payload?.data?.data || payload?.data || {};

      const msgs = data?.msgs || [];
      const controls = data?.controls || [];

      if (msgs.length > 0) {
        const direction = event.includes('SENT') ? 'OUTGOING' : 'INCOMING';
        const isGroup = event.includes('GROUP');

        const records = msgs.map((msg: any) => ({
          direction, platform, account_id: accountId,
          sender_id: msg.uidFrom || msg.senderId || '',
          sender_name: msg.dName || msg.senderName || '',
          recipient_id: msg.idTo || '',
          group_id: isGroup ? (msg.idTo || msg.groupId || null) : null,
          msg_id: msg.msgId || msg.globalMsgId || '',
          msg_type: isGroup ? 'group' : 'webchat',
          content: msg.content || msg.text || '',
          event, raw_payload: msg,
          status: direction === 'OUTGOING' ? 'SENT' : 'RECEIVED',
        }));

        await prisma.zaloMessage.createMany({ data: records });
        logger.info(`Zalo webhook: saved ${records.length} ${direction} messages (${event})`);

        // Auto-create orders from incoming messages (fire-and-forget)
        if (direction === 'INCOMING') {
          for (const msg of msgs) {
            const msgContent = msg.content || msg.text || '';
            if (msgContent && msgContent.length > 5) {
              ZaloOrderService.processMessage(
                msg.uidFrom || msg.senderId || '',
                msg.dName || msg.senderName || '',
                msgContent,
              ).then((result) => {
                if (result.created) {
                  logger.info(`Zalo auto-order: ${result.order_code} created from message`);
                }
              }).catch((err) => {
                logger.error('Zalo auto-order background error:', err);
              });
            }
          }
        }

        return { received: records.length };
      }

      if (controls.length > 0) {
        const records = controls.map((ctrl: any) => {
          const content = ctrl.content || {};
          const act = content.act || 'unknown';
          const actType = content.act_type || '';
          let parsedData: any = {};
          try { parsedData = typeof content.data === 'string' ? JSON.parse(content.data) : content.data || {}; } catch { /* */ }

          const members = parsedData.updateMembers || [];
          const memberNames = members.map((m: any) => m.dName).join(', ');
          const groupName = parsedData.groupName || '';
          const controlEvent = `${actType.toUpperCase()}_${act.toUpperCase()}`;

          return {
            direction: 'INCOMING', platform, account_id: accountId,
            sender_id: '', sender_name: memberNames || '',
            recipient_id: '', group_id: parsedData.groupId || 'unknown_group',
            msg_id: ctrl.actionId || ctrl.controlId || '', msg_type: 'control',
            content: `[${controlEvent}] ${memberNames} → ${groupName}`,
            event: controlEvent, raw_payload: ctrl, status: 'RECEIVED',
          };
        });

        await prisma.zaloMessage.createMany({ data: records });
        logger.info(`Zalo webhook: saved ${records.length} control events`);
        return { received: records.length };
      }

      logger.info(`Zalo webhook: event ${event} with no actionable data`);
      return { received: 0, event };
    } catch (err) {
      logger.error('Zalo webhook processing error:', err);
      throw err;
    }
  }

  // ──── Local DB queries ────

  static async getMessages(filters: {
    page?: number; limit?: number; sender_id?: string; group_id?: string;
    direction?: string; search?: string; type?: string;
  }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const { sender_id, group_id, direction, search, type } = filters;

    const where = {
      ...(sender_id && { sender_id, msg_type: { not: 'control' } }),
      ...(group_id && { group_id }),
      ...(direction && { direction }),
      ...(type === 'personal' && { group_id: null, msg_type: { not: 'control' } }),
      ...(type === 'group' && { group_id: { not: null }, msg_type: { not: 'control' } }),
      ...(search && {
        OR: [
          { content: { contains: search, mode: 'insensitive' as const } },
          { sender_name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [messages, total] = await Promise.all([
      prisma.zaloMessage.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.zaloMessage.count({ where }),
    ]);

    return { messages, total, page, limit, total_pages: Math.ceil(total / limit) };
  }

  static async getStats() {
    const [total, today] = await Promise.all([
      prisma.zaloMessage.count(),
      prisma.zaloMessage.count({ where: { created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    return { total_messages: total, today_messages: today };
  }

  // ──── Sync messages from Func.vn → DB ────

  static async syncMessages() {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_threads_url || !cfg.get_messages_url) {
      throw new AppError(t('zalo.configNotFound'), 400);
    }

    // 1. Fetch all threads (personal + group)
    const threadsResult = await this.callFunc(cfg.get_threads_url, cfg.get_threads_token!, { limit: 100 });
    const threads = (threadsResult?.data || []).filter(
      (th: any) => th.last_content,
    );

    let totalSynced = 0;
    let totalSkipped = 0;

    // 2. For each thread, fetch messages and save to DB
    for (const thread of threads) {
      try {
        const msgsResult = await this.callFunc(cfg.get_messages_url, cfg.get_messages_token!, {
          contact_pid: thread.pid,
          limit: 100,
        });
        const msgs = msgsResult?.data || [];

        for (const msg of msgs) {
          const msgId = msg.origin?.msgId || msg.id || '';
          const content = msg.text || msg.content || '';

          // Skip empty, sticker-only, or control messages
          if (!content && msg.type !== 'TEXT') continue;

          // Check if already exists by msg_id
          if (msgId) {
            const exists = await prisma.zaloMessage.findFirst({ where: { msg_id: msgId } });
            if (exists) { totalSkipped++; continue; }
          }

          const isMe = msg.sender_pid === thread.account_pid;
          const isGroup = thread.type === 'GROUP_MESSAGING';
          const sentAt = msg.sent_at ? new Date(msg.sent_at) : new Date(msg.created_at);

          await prisma.zaloMessage.create({
            data: {
              direction: isMe ? 'OUTGOING' : 'INCOMING',
              platform: 'ZALO_USER',
              account_id: thread.account_pid || '',
              sender_id: msg.sender?.pid || msg.sender_pid || '',
              sender_name: msg.sender?.name || msg.origin?.dName || '',
              recipient_id: msg.receiver_pid || '',
              group_id: isGroup ? thread.pid : null,
              msg_id: msgId,
              msg_type: isGroup ? 'group' : 'webchat',
              content,
              event: isMe ? 'SENT_MESSAGE' : 'RECEIVED_MESSAGE',
              raw_payload: msg,
              status: isMe ? 'SENT' : 'RECEIVED',
              created_at: sentAt,
            },
          });
          totalSynced++;
        }
      } catch (err: any) {
        logger.warn(`Sync error for thread ${thread.name}: ${err.message}`);
      }
    }

    logger.info(`Zalo sync complete: ${totalSynced} new, ${totalSkipped} skipped, ${threads.length} threads`);
    return { synced: totalSynced, skipped: totalSkipped, threads_processed: threads.length };
  }

  // ──── AI Chat ────

  static async aiChat(question: string, limit: number = 100) {
    const messages = await prisma.zaloMessage.findMany({
      where: { msg_type: { not: 'control' } },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: { sender_name: true, content: true, direction: true, created_at: true },
    });

    const reversed = [...messages].reverse();
    const answer = await AIService.chatAboutMessages(question, reversed);
    return { question, answer, messages_analyzed: messages.length };
  }

  // ──── AI Summary ────

  static async aiSummary(hours: number = 24, limit: number = 100) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const messages = await prisma.zaloMessage.findMany({
      where: { msg_type: { not: 'control' }, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: { sender_name: true, content: true, direction: true, created_at: true },
    });

    if (messages.length === 0) {
      return { summary: 'Không có tin nhắn nào trong khoảng thời gian này.', messages_analyzed: 0 };
    }

    const reversed = [...messages].reverse();
    const result = await AIService.summarizeMessages(reversed);
    return { ...result, messages_analyzed: messages.length, period_hours: hours };
  }
}
