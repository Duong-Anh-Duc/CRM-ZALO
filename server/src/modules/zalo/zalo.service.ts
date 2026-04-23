import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import logger from '../../utils/logger';
import axios from 'axios';
import { ZaloOrderService } from './zalo-order.service';
import { AIService } from '../ai/ai.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { InvoiceService } from '../invoice/invoice.service';
import { VATRate } from '@prisma/client';
import dayjs from 'dayjs';

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

  // ──── Helper: call Func.vn API (with retry on 429) ────

  private static async callFunc(url: string, token: string, body: Record<string, unknown>, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await axios.post(url, body, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          timeout: 30000,
        });
        return response.data;
      } catch (err: any) {
        if (err.response?.status === 429 && attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
        logger.error(`Func.vn API error: ${msg}`, { url, status: err.response?.status });
        throw new AppError(`Func.vn: ${msg}`, err.response?.status || 500);
      }
    }
  }

  private static delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

  // ──── Send / Reply / Typing (Func.vn USER_SEND_* APIs) ────

  static async sendTyping(userId: string): Promise<void> {
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    if (!cfg?.send_typing_enabled) return;
    if (!cfg?.send_typing_url || !cfg?.send_typing_token) return; // optional
    try {
      await this.callFunc(cfg.send_typing_url, cfg.send_typing_token, { user_id: userId });
    } catch (err) {
      logger.warn('sendTyping failed', err);
    }
  }

  static async sendMessage(userId: string, content: string): Promise<any> {
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    if (!cfg?.send_message_enabled) {
      throw new AppError('USER_SEND_MESSAGE đang bị tắt trong cấu hình', 400);
    }
    if (!cfg?.send_message_url || !cfg?.send_message_token) {
      throw new AppError('Zalo send_message_url chưa cấu hình', 400);
    }
    const result = await this.callFunc(cfg.send_message_url, cfg.send_message_token, { user_id: userId, message: content });
    await prisma.zaloMessage.create({
      data: {
        direction: 'OUTGOING', platform: 'ZALO_USER',
        sender_id: '', recipient_id: userId, content,
        msg_type: 'webchat', event: 'SENT_MESSAGE',
        status: 'SENT', raw_payload: result,
      },
    });
    return result;
  }

  static async sendImages(userId: string, imageUrls: string[]): Promise<any> {
    if (!imageUrls || imageUrls.length === 0) return null;
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    if (!cfg?.send_images_enabled) {
      logger.warn('sendImages skipped — action disabled');
      return null;
    }
    if (!cfg?.send_images_url || !cfg?.send_images_token) {
      logger.warn('sendImages skipped — send_images_url not configured');
      return null;
    }
    const result = await this.callFunc(cfg.send_images_url, cfg.send_images_token, {
      user_id: userId,
      urls: imageUrls,
    });
    await prisma.zaloMessage.create({
      data: {
        direction: 'OUTGOING', platform: 'ZALO_USER',
        sender_id: '', recipient_id: userId, content: imageUrls.join(' | '),
        msg_type: 'webchat', event: 'SENT_IMAGES',
        status: 'SENT', raw_payload: result,
      },
    });
    return result;
  }

  static async replyMessage(userId: string, originalPayload: any, content: string): Promise<any> {
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    if (!cfg?.reply_message_enabled) {
      // fallback to sendMessage when reply disabled
      return this.sendMessage(userId, content);
    }
    if (!cfg?.reply_message_url || !cfg?.reply_message_token || !originalPayload) {
      // fallback to sendMessage if no reply config or no original msg payload to quote
      return this.sendMessage(userId, content);
    }
    const result = await this.callFunc(cfg.reply_message_url, cfg.reply_message_token, {
      user_id: userId,
      message: content,
      reply_message: originalPayload,
    });
    await prisma.zaloMessage.create({
      data: {
        direction: 'OUTGOING', platform: 'ZALO_USER',
        sender_id: '', recipient_id: userId, content,
        msg_type: 'webchat', event: 'SENT_REPLY',
        status: 'SENT', raw_payload: result,
      },
    });
    return result;
  }

  // ──── Group APIs (GROUP_SEND_MESSAGE / GROUP_SEND_IMAGE / GROUP_REPLY_MESSAGE) ────

  static async groupSendMessage(
    groupId: string,
    content: string,
    extras?: { mentions?: any[]; styles?: any[] },
  ): Promise<any> {
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    if (!cfg?.group_send_message_enabled) {
      throw new AppError('GROUP_SEND_MESSAGE đang bị tắt trong cấu hình', 400);
    }
    if (!cfg?.group_send_message_url || !cfg?.group_send_message_token) {
      throw new AppError('Zalo group_send_message_url chưa cấu hình', 400);
    }
    const result = await this.callFunc(cfg.group_send_message_url, cfg.group_send_message_token, {
      group_id: groupId,
      message: content,
      mentions: extras?.mentions ?? [],
      styles: extras?.styles ?? [],
    });
    await prisma.zaloMessage.create({
      data: {
        direction: 'OUTGOING', platform: 'ZALO_USER',
        sender_id: '', group_id: groupId, content,
        msg_type: 'group', event: 'SENT_GROUP_MESSAGE',
        status: 'SENT', raw_payload: result,
      },
    });
    return result;
  }

  static async groupSendImage(groupId: string, url: string, desc?: string): Promise<any> {
    if (!url) return null;
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    if (!cfg?.group_send_image_enabled) {
      logger.warn('groupSendImage skipped — action disabled');
      return null;
    }
    if (!cfg?.group_send_image_url || !cfg?.group_send_image_token) {
      logger.warn('groupSendImage skipped — group_send_image_url not configured');
      return null;
    }
    const result = await this.callFunc(cfg.group_send_image_url, cfg.group_send_image_token, {
      group_id: groupId,
      url,
      desc: desc ?? '',
    });
    await prisma.zaloMessage.create({
      data: {
        direction: 'OUTGOING', platform: 'ZALO_USER',
        sender_id: '', group_id: groupId, content: url,
        msg_type: 'group', event: 'SENT_GROUP_IMAGE',
        status: 'SENT', raw_payload: result,
      },
    });
    return result;
  }

  static async groupReplyMessage(
    groupId: string,
    originalPayload: any,
    content: string,
    extras?: { styles?: any[] },
  ): Promise<any> {
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    if (!cfg?.group_reply_message_enabled) {
      return this.groupSendMessage(groupId, content);
    }
    if (!cfg?.group_reply_message_url || !cfg?.group_reply_message_token || !originalPayload) {
      return this.groupSendMessage(groupId, content);
    }
    const result = await this.callFunc(cfg.group_reply_message_url, cfg.group_reply_message_token, {
      group_id: groupId,
      message: content,
      reply_message: originalPayload,
      styles: extras?.styles ?? [],
    });
    await prisma.zaloMessage.create({
      data: {
        direction: 'OUTGOING', platform: 'ZALO_USER',
        sender_id: '', group_id: groupId, content,
        msg_type: 'group', event: 'SENT_GROUP_REPLY',
        status: 'SENT', raw_payload: result,
      },
    });
    return result;
  }

  // ──── Auto-reply AI handler ────

  private static async autoReplyIncoming(senderId: string, senderName: string, content: string, originalPayload: any): Promise<void> {
    try {
      const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
      if (!cfg?.auto_reply_enabled) return;

      const thread = await prisma.zaloThread.upsert({
        where: { thread_key: senderId },
        create: { thread_key: senderId, is_group: false, auto_reply_enabled: true },
        update: {},
      });
      if (!thread.auto_reply_enabled) return;

      if (cfg.auto_reply_off_hours_only) {
        const hour = new Date().getHours();
        if (hour >= 8 && hour < 18) return;
      }

      if (thread.last_auto_reply_at && Date.now() - thread.last_auto_reply_at.getTime() < 3_000) return;

      // ── Branch: image vs text ──
      const isImage = originalPayload?.msgType === 'chat.photo'
        || originalPayload?.type === 'ATTACHMENT'
        || (typeof content === 'string' && content.startsWith('https://') && /\.(jpg|jpeg|png|webp)/i.test(content));

      await this.sendTyping(senderId);

      let answer = '';
      let productImageUrls: string[] = [];
      if (isImage) {
        const imageUrl = (content && content.startsWith('http')) ? content
          : (originalPayload?.content?.href || originalPayload?.attachments?.[0]?.url || '');
        if (!imageUrl) {
          logger.warn(`Auto-reply: image detected but no URL found for ${senderName}`);
          return;
        }
        const built = await this.buildImageProductReply(imageUrl);
        answer = built.text;
        productImageUrls = built.imageUrls;
      } else {
        if (!content || content.trim().length < 3) return;
        const history = await prisma.zaloMessage.findMany({
          where: { OR: [{ sender_id: senderId }, { recipient_id: senderId }], msg_type: { not: 'control' } },
          orderBy: { created_at: 'desc' }, take: 6,
        });
        const historyForAI = history.reverse().map((m) => ({
          role: m.direction === 'INCOMING' ? 'user' : 'ai',
          content: m.content || '',
        }));
        const { ChatbotService } = await import('../ai/chatbot.service');
        answer = await ChatbotService.customerReply(content, historyForAI, cfg.auto_reply_prompt || undefined);
      }

      if (!answer || answer.trim().length === 0) return;

      if (originalPayload) {
        await this.replyMessage(senderId, originalPayload, answer);
      } else {
        await this.sendMessage(senderId, answer);
      }

      // If this was an image search → also send candidate product images
      if (productImageUrls.length > 0) {
        await this.delay(500);
        await this.sendImages(senderId, productImageUrls).catch((err) => {
          logger.warn('Failed to send product images:', err);
        });
      }

      await prisma.zaloThread.update({
        where: { thread_key: senderId },
        data: { last_auto_reply_at: new Date() },
      });

      logger.info(`Auto-reply sent to ${senderName} (${senderId}): ${answer.substring(0, 80)}`);
    } catch (err) {
      logger.error('Auto-reply error:', err);
    }
  }

  /**
   * Build reply for customer-sent image — returns text + candidate product image URLs.
   */
  private static async buildImageProductReply(imageUrl: string): Promise<{ text: string; imageUrls: string[] }> {
    const { ChatbotService } = await import('../ai/chatbot.service');
    const { ProductService } = await import('../product/product.service');

    const attrs = await ChatbotService.identifyProductFromImage(imageUrl);
    logger.info(`Image analysis: ${JSON.stringify(attrs)}`);

    if (!attrs.loai || attrs.confidence < 0.4) {
      return {
        text: 'Dạ em nhận ảnh rồi nhưng chưa xác định rõ sản phẩm bao bì ạ. Anh/chị gửi giúp em thêm ảnh góc khác hoặc ghi rõ dung tích, chất liệu để em tìm đúng mẫu nhé.',
        imageUrls: [],
      };
    }

    const products = await ProductService.fuzzyMatchByAttributes(attrs);

    if (products.length === 0) {
      return {
        text: `Dạ em thấy anh/chị đang tìm ${attrs.loai}${attrs.dung_tich_ml ? ` ~${attrs.dung_tich_ml}ml` : ''}${attrs.chat_lieu ? ` ${attrs.chat_lieu}` : ''} nhưng hiện bên em chưa có mẫu giống. Anh/chị để lại SĐT để nhân viên tư vấn báo giá trực tiếp nhé ạ.`,
        imageUrls: [],
      };
    }

    const lines: string[] = [`Dạ bên em có ${products.length} mẫu gần giống với ảnh anh/chị gửi ạ:`];
    const imageUrls: string[] = [];
    products.forEach((p: any, i: number) => {
      const specs: string[] = [];
      if (p.capacity_ml) specs.push(`${p.capacity_ml}ml`);
      if (p.material) specs.push(p.material);
      const specStr = specs.length > 0 ? ` — ${specs.join(', ')}` : '';
      lines.push(`${i + 1}. ${p.name}${specStr}`);
      const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
      if (img?.url && /^https?:\/\//.test(img.url)) imageUrls.push(img.url);
    });
    lines.push('');
    lines.push('Anh/chị cần em tư vấn thêm về mẫu nào ạ? (giá, số lượng tồn, quy cách đóng gói...)');

    return { text: lines.join('\n'), imageUrls };
  }

  // ──── Per-thread auto-reply toggle ────

  static async toggleThreadAutoReply(threadKey: string, enabled: boolean) {
    return prisma.zaloThread.upsert({
      where: { thread_key: threadKey },
      create: { thread_key: threadKey, is_group: false, auto_reply_enabled: !!enabled },
      update: { auto_reply_enabled: !!enabled },
    });
  }

  static async getThreadSetting(threadKey: string) {
    const thread = await prisma.zaloThread.findUnique({ where: { thread_key: threadKey } });
    return thread || { thread_key: threadKey, auto_reply_enabled: false };
  }

  // ──── 1. FUNC_GET_THREADS (paginated — fetches ALL) ────

  private static async fetchAllThreads(cfg: any) {
    let allThreads: any[] = [];
    let cursor: string | undefined;

    while (true) {
      const body: Record<string, unknown> = { limit: 100 };
      if (cursor) body.after_last_content_at = cursor;

      const result = await this.callFunc(cfg.get_threads_url, cfg.get_threads_token, body);
      const batch = result?.data || [];
      if (batch.length === 0) break;

      allThreads = allThreads.concat(batch);
      if (batch.length < 100) break;

      const oldest = batch[batch.length - 1];
      const nextCursor = oldest.last_content_at || oldest.updated_at || oldest.created_at;
      if (!nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    }

    return allThreads;
  }

  // Enrich from local DB only — zero extra API calls
  private static async enrichThreadsFromDB(threads: any[]) {
    const withContent = threads.filter((th: any) => th.last_content);
    const noContent = threads.filter((th: any) => !th.last_content);

    if (noContent.length === 0) return withContent;

    // Personal: only count DM messages (group_id is null)
    const dbPersonal = await prisma.zaloMessage.groupBy({
      by: ['sender_id'],
      where: { group_id: null, msg_type: { not: 'control' }, content: { not: '' } },
      _max: { content: true, created_at: true },
    });
    // Group: match by group_id
    const dbGroups = await prisma.zaloMessage.groupBy({
      by: ['group_id'],
      where: { group_id: { not: null }, msg_type: { not: 'control' }, content: { not: '' } },
      _max: { content: true, created_at: true },
    });

    const personalLookup = new Map<string, { content: string; date: string }>();
    for (const s of dbPersonal) {
      if (s.sender_id) personalLookup.set(s.sender_id, { content: s._max.content || '[Tin nhắn]', date: s._max.created_at?.toISOString() || '' });
    }
    const groupLookup = new Map<string, { content: string; date: string }>();
    for (const g of dbGroups) {
      if (g.group_id) groupLookup.set(g.group_id, { content: g._max.content || '[Tin nhắn]', date: g._max.created_at?.toISOString() || '' });
    }

    const discovered: any[] = [];
    for (const th of noContent) {
      const isGroup = th.type === 'GROUP_MESSAGING';
      const lookup = isGroup ? groupLookup : personalLookup;
      const match = lookup.get(th.pid) || lookup.get(th.origin_id);
      if (match) {
        th.last_content = match.content;
        th.last_content_at = match.date;
        discovered.push(th);
      }
    }

    return [...withContent, ...discovered];
  }

  static async getThreads(limit?: number, type?: string) {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_threads_url || !cfg.get_threads_token) throw new AppError(t('zalo.configNotFound'), 400);

    let allThreads = await this.fetchAllThreads(cfg);

    // Filter by type (Func.vn is_group param is unreliable)
    if (type === 'personal') {
      allThreads = allThreads.filter((th: any) => th.type === 'PRIVATE_MESSAGING');
    } else if (type === 'group') {
      allThreads = allThreads.filter((th: any) => th.type === 'GROUP_MESSAGING');
    }

    // Show threads with last_content + threads with messages in local DB
    allThreads = await this.enrichThreadsFromDB(allThreads);

    if (limit && allThreads.length > limit) {
      allThreads = allThreads.slice(0, limit);
    }

    // Sort by last_content_at descending
    allThreads.sort((a: any, b: any) => {
      const ta = a.last_content_at || a.updated_at || a.created_at;
      const tb = b.last_content_at || b.updated_at || b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    return allThreads;
  }

  // ──── 2. FUNC_GET_MESSAGES (paginated — fetches ALL) ────

  static async getMessagesByContact(contact_pid: string, limit?: number) {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_messages_url || !cfg.get_messages_token) throw new AppError(t('zalo.configNotFound'), 400);

    const accountPid = cfg.account_token ? undefined : undefined; // resolved below
    let allMessages: any[] = [];
    let beforeSentAt: number | undefined;

    // Paginate through all messages using before_sent_at
    while (true) {
      const body: Record<string, unknown> = { contact_pid, limit: 100 };
      if (beforeSentAt) body.before_sent_at = beforeSentAt;

      const result = await this.callFunc(cfg.get_messages_url, cfg.get_messages_token, body);
      const batch = result?.data || [];
      if (batch.length === 0) break;

      // Filter: only keep messages belonging to this conversation
      const filtered = batch.filter((msg: any) =>
        msg.contact_pid === contact_pid ||
        msg.sender_pid === contact_pid ||
        msg.receiver_pid === contact_pid,
      );
      allMessages = allMessages.concat(filtered);

      // Stop if we got less than 100 (last page) or reached requested limit
      if (batch.length < 100) break;
      if (limit && allMessages.length >= limit) { allMessages = allMessages.slice(0, limit); break; }

      // Use oldest message's sent_at as cursor
      const oldest = batch[batch.length - 1];
      const nextCursor = oldest.sent_at;
      if (!nextCursor || nextCursor === beforeSentAt) break;
      beforeSentAt = nextCursor;
    }

    return allMessages;
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

    const result = await this.callFunc(cfg.get_user_info_url, cfg.get_user_info_token, { user_id });
    const profiles = result?.data?.data?.changed_profiles || {};
    const info = Object.values(profiles)[0] || null;
    return info;
  }

  // ──── 5. GET_USER_INFO_EXTRA ────

  static async getUserInfoExtra(user_id: string) {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_user_extra_url || !cfg.get_user_extra_token) throw new AppError(t('zalo.configNotFound'), 400);

    const result = await this.callFunc(cfg.get_user_extra_url, cfg.get_user_extra_token, { user_id });
    return result?.data || null;
  }

  // ──── Thread Classification ────

  static async classifyThread(
    sender_id: string,
    sender_name?: string,
    phone?: string,
  ): Promise<{ type: 'CUSTOMER' | 'SUPPLIER' | 'UNKNOWN'; entity: any }> {
    try {
      // 1. Check if sender_id already linked to a Customer
      const customerByZalo = await prisma.customer.findFirst({
        where: { zalo_user_id: sender_id, is_active: true },
      });
      if (customerByZalo) return { type: 'CUSTOMER', entity: customerByZalo };

      // 2. Check if sender_id already linked to a Supplier
      const supplierByZalo = await prisma.supplier.findFirst({
        where: { zalo_user_id: sender_id, is_active: true },
      });
      if (supplierByZalo) return { type: 'SUPPLIER', entity: supplierByZalo };

      // 3. Try to match by phone number (if provided)
      if (phone) {
        const normalizedPhone = phone.replace(/\D/g, '').replace(/^84/, '0');

        const customerByPhone = await prisma.customer.findFirst({
          where: { phone: { contains: normalizedPhone }, is_active: true },
        });
        if (customerByPhone) {
          await prisma.customer.update({
            where: { id: customerByPhone.id },
            data: { zalo_user_id: sender_id },
          });
          logger.info(`Auto-linked Zalo ${sender_id} to customer "${customerByPhone.company_name}" via phone ${normalizedPhone}`);
          return { type: 'CUSTOMER', entity: customerByPhone };
        }

        const supplierByPhone = await prisma.supplier.findFirst({
          where: { phone: { contains: normalizedPhone }, is_active: true },
        });
        if (supplierByPhone) {
          await prisma.supplier.update({
            where: { id: supplierByPhone.id },
            data: { zalo_user_id: sender_id },
          });
          logger.info(`Auto-linked Zalo ${sender_id} to supplier "${supplierByPhone.company_name}" via phone ${normalizedPhone}`);
          return { type: 'SUPPLIER', entity: supplierByPhone };
        }
      }

      return { type: 'UNKNOWN', entity: null };
    } catch (err) {
      logger.error('Thread classification error:', err);
      return { type: 'UNKNOWN', entity: null };
    }
  }

  // ──── Webhook ────

  static async handleWebhook(payload: any) {
    try {
      const event = payload?.payload?.event || payload?.event || 'UNKNOWN';
      const platform = payload?.payload?.platform || payload?.platform || 'ZALO_USER';
      const accountId = payload?.payload?.account_id || payload?.account_id || '';
      const data = payload?.payload?.data?.data || payload?.data?.data || payload?.data || {};

      // DEBUG: log full payload to investigate unknown message types (photos, stickers, files)
      logger.info(`Zalo webhook event=${event} data_keys=[${Object.keys(data).join(',')}] payload_preview=${JSON.stringify(payload).substring(0, 1500)}`);

      const msgs = data?.msgs || [];
      const controls = data?.controls || [];

      if (msgs.length > 0) {
        const direction = event.includes('SENT') ? 'OUTGOING' : 'INCOMING';
        const isGroup = event.includes('GROUP');

        const records = msgs.map((msg: any) => {
          // For image/sticker/file messages, content may be an object {href, thumb, ...}
          // or empty. Extract URL so we save a usable string.
          let textContent = '';
          if (typeof msg.content === 'string') {
            textContent = msg.content;
          } else if (msg.content && typeof msg.content === 'object') {
            // Image: {href, thumb, ...} | Sticker: {href, catId, ...} | File: {href, fileName}
            textContent = msg.content.href || msg.content.url || msg.content.thumb || '';
          } else if (typeof msg.text === 'string') {
            textContent = msg.text;
          }

          return {
            direction, platform, account_id: accountId,
            sender_id: msg.uidFrom || msg.senderId || '',
            sender_name: msg.dName || msg.senderName || '',
            recipient_id: msg.idTo || '',
            group_id: isGroup ? (msg.idTo || msg.groupId || null) : null,
            msg_id: msg.msgId || msg.globalMsgId || '',
            msg_type: isGroup ? 'group' : 'webchat',
            content: textContent,
            event, raw_payload: msg,
            status: direction === 'OUTGOING' ? 'SENT' : 'RECEIVED',
          };
        });

        await prisma.zaloMessage.createMany({ data: records });
        logger.info(`Zalo webhook: saved ${records.length} ${direction} messages (${event})`);

        // Auto-detect & process incoming messages (fire-and-forget)
        if (direction === 'INCOMING' && !isGroup) {
          for (const msg of msgs) {
            const msgContent = msg.content || msg.text || '';
            const senderName = msg.dName || msg.senderName || '';
            const senderId = msg.uidFrom || msg.senderId || '';

            // Classify thread (fire-and-forget)
            if (senderId) {
              this.classifyThread(senderId, senderName, msg.phone).catch((err) => {
                logger.error('Zalo thread classification error:', err);
              });
            }

            if (!msgContent || msgContent.length < 3) continue;

            this.autoProcessMessage(senderId, senderName, msgContent).catch((err) => {
              logger.error('Zalo auto-process error:', err);
            });

            // Auto-reply AI (fire-and-forget) — pass full original msg payload for reply_message
            this.autoReplyIncoming(senderId, senderName, msgContent, msg).catch((err) => {
              logger.error('Zalo auto-reply error:', err);
            });
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

  // ──── Auto-process incoming Zalo messages ────

  private static async createNotification(type: string, title: string, message: string) {
    await prisma.alert.create({
      data: { type, title, message, is_read: false },
    });
    logger.info(`Notification: [${type}] ${title}`);
  }

  private static async autoProcessMessage(senderId: string, senderName: string, content: string) {
    const text = content.toLowerCase();

    // 1. Detect payment ("đã chuyển khoản", "đã ck", "đã thanh toán", "đã gửi tiền")
    const paymentPatterns = /đã (chuyển khoản|ck|thanh toán|gửi tiền|chuyển tiền|trả tiền|cọc)/i;
    const amountMatch = content.match(/(\d[\d.,]*)\s*(k|tr|triệu|nghìn|ngàn|đ|dong|vnđ|vnd)?/i);

    if (paymentPatterns.test(content) && amountMatch) {
      let amount = parseFloat(amountMatch[1].replace(/[.,]/g, ''));
      const unit = (amountMatch[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') amount *= 1000;
      if (unit === 'tr' || unit === 'triệu') amount *= 1000000;

      if (amount > 0) {
        // Find customer by zalo_user_id or name
        const customer = await prisma.customer.findFirst({
          where: {
            is_active: true,
            OR: [
              { zalo_user_id: senderId },
              { contact_name: { contains: senderName, mode: 'insensitive' as const } },
            ],
          },
        });

        if (customer) {
          // Find unpaid receivable
          const receivable = await prisma.receivable.findFirst({
            where: { customer_id: customer.id, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
            include: { sales_order: { select: { order_code: true } } },
            orderBy: { due_date: 'asc' },
          });

          if (receivable) {
            const payAmount = Math.min(amount, Number(receivable.remaining));
            await prisma.$transaction(async (tx) => {
              await tx.receivablePayment.create({
                data: {
                  receivable_id: receivable.id,
                  amount: payAmount,
                  payment_date: new Date(),
                  method: 'BANK_TRANSFER',
                  reference: `Zalo: ${senderName} - "${content.substring(0, 50)}"`,
                },
              });
              const newPaid = Number(receivable.paid_amount) + payAmount;
              const newRemaining = Number(receivable.original_amount) - newPaid;
              await tx.receivable.update({
                where: { id: receivable.id },
                data: { paid_amount: newPaid, remaining: Math.max(0, newRemaining), status: newRemaining <= 0 ? 'PAID' : 'PARTIAL' },
              });
            });

            await this.createNotification(
              'WARNING',
              `Thanh toán từ ${senderName}`,
              `${senderName} báo đã thanh toán ${payAmount.toLocaleString()}đ cho đơn ${receivable.sales_order?.order_code}. Công nợ còn: ${Math.max(0, Number(receivable.remaining) - payAmount).toLocaleString()}đ. Vui lòng kiểm tra tài khoản ngân hàng.`,
            );
            return;
          }
        }

        // No matching receivable — still notify
        await this.createNotification(
          'WARNING',
          `Thanh toán từ ${senderName}`,
          `${senderName} báo đã thanh toán ${amount.toLocaleString()}đ nhưng chưa tìm thấy công nợ tương ứng. Nội dung: "${content.substring(0, 100)}"`,
        );
        return;
      }
    }

    // 2. Detect order ("đặt hàng", "mua", "order", kèm số lượng)
    const orderPatterns = /đặt|mua|order|lấy|cần|gửi.*\d/i;
    const hasQuantity = /\d+\s*(cái|chai|hũ|can|nắp|thùng|kg|lít|bộ|c\b|k\b)/i.test(content);

    if (orderPatterns.test(content) && hasQuantity && content.length > 10) {
      // Use existing AI extraction
      ZaloOrderService.processMessage(senderId, senderName, content).then((result) => {
        if (result.suggested) {
          this.createNotification(
            'URGENT',
            `Đơn hàng mới từ ${senderName}`,
            `${senderName} có yêu cầu đặt hàng: "${content.substring(0, 150)}". Đơn đã tạo ở trạng thái chờ duyệt.`,
          );
        }
      }).catch(() => {});
      return;
    }

    // 3. Detect delivery confirmation ("đã nhận hàng", "hàng đã đến", "đã giao")
    const deliveryPatterns = /đã (nhận hàng|nhận được|giao xong|giao rồi)|hàng (đã đến|đã nhận|ok)/i;
    if (deliveryPatterns.test(content)) {
      const customer = await prisma.customer.findFirst({
        where: {
          is_active: true,
          OR: [
            { zalo_user_id: senderId },
            { contact_name: { contains: senderName, mode: 'insensitive' as const } },
          ],
        },
      });

      if (customer) {
        const shippingOrder = await prisma.salesOrder.findFirst({
          where: { customer_id: customer.id, status: 'SHIPPING' },
          orderBy: { created_at: 'desc' },
        });

        if (shippingOrder) {
          await prisma.salesOrder.update({ where: { id: shippingOrder.id }, data: { status: 'COMPLETED' } });
          await this.createNotification(
            'WARNING',
            `Xác nhận giao hàng - ${senderName}`,
            `${senderName} xác nhận đã nhận hàng đơn ${shippingOrder.order_code}. Đơn đã chuyển sang Hoàn thành.`,
          );
          return;
        }
      }

      await this.createNotification(
        'WARNING',
        `Xác nhận giao hàng - ${senderName}`,
        `${senderName} báo đã nhận hàng: "${content.substring(0, 100)}"`,
      );
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

  // ──── Sync ALL messages from Func.vn → DB (sequential, rate-limit safe) ────

  static async syncMessages() {
    const cfg = await this.getActiveConfig();
    if (!cfg.get_threads_url || !cfg.get_messages_url) {
      throw new AppError(t('zalo.configNotFound'), 400);
    }

    // 1. Fetch ALL threads directly (no enrich)
    const allThreads = await this.fetchAllThreads(cfg);

    let totalSynced = 0;
    let totalSkipped = 0;
    let threadsWithMsgs = 0;

    // 2. For each thread, fetch ALL messages with delay between threads
    for (const thread of allThreads) {
      try {
        // Fetch all messages for this thread (paginated, with delay between pages)
        let allMsgs: any[] = [];
        let beforeSentAt: number | undefined;

        while (true) {
          const body: Record<string, unknown> = { contact_pid: thread.pid, limit: 100 };
          if (beforeSentAt) body.before_sent_at = beforeSentAt;

          const result = await this.callFunc(cfg.get_messages_url, cfg.get_messages_token!, body);
          const batch = result?.data || [];
          if (batch.length === 0) break;

          allMsgs = allMsgs.concat(batch);
          if (batch.length < 100) break;

          const oldest = batch[batch.length - 1];
          const nc = oldest.sent_at;
          if (!nc || nc === beforeSentAt) break;
          beforeSentAt = nc;

          await this.delay(500); // delay between pages
        }

        if (allMsgs.length === 0) {
          await this.delay(200); // small delay even for empty threads
          continue;
        }

        threadsWithMsgs++;

        for (const msg of allMsgs) {
          const msgId = msg.origin?.msgId || msg.id || '';
          let content = msg.text || msg.content || '';

          // Extract URL for non-text messages (image/sticker/file)
          if (!content) {
            const firstAttach = Array.isArray(msg.attachments) && msg.attachments.length > 0 ? msg.attachments[0] : null;
            const attachUrl = firstAttach?.url || firstAttach?.href || '';
            const stickerUrl = msg.origin?.content?.href || msg.origin?.content?.thumb || '';
            if (msg.type === 'PHOTO' || msg.type === 'IMAGE' || firstAttach?.type === 'image') {
              content = attachUrl || stickerUrl || '[IMAGE]';
            } else if (msg.type === 'STICKER' || msg.origin?.msgType === 'chat.sticker') {
              content = stickerUrl || '[STICKER]';
            } else if (msg.type === 'ATTACHMENT' || msg.type === 'FILE') {
              content = attachUrl || '[FILE]';
            } else {
              // Unknown non-text → skip to avoid empty rows
              continue;
            }
          }

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

        await this.delay(500); // delay between threads
      } catch (err: any) {
        logger.warn(`Sync error for thread ${thread.name}: ${err.message}`);
        await this.delay(2000); // longer delay on error (likely 429)
      }
    }

    logger.info(`Zalo sync complete: ${totalSynced} new, ${totalSkipped} skipped, ${threadsWithMsgs}/${allThreads.length} threads had messages`);
    return { synced: totalSynced, skipped: totalSkipped, threads_processed: allThreads.length, threads_with_messages: threadsWithMsgs };
  }

  // ──── AI Chat ────

  static async aiChat(question: string, limit: number = 100, userId?: string) {
    const messages = await prisma.zaloMessage.findMany({
      where: { msg_type: { not: 'control' } },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: { sender_name: true, content: true, direction: true, created_at: true },
    });

    const reversed = [...messages].reverse();
    let answer = await AIService.chatAboutMessages(question, reversed);

    // Execute actions if AI returned any
    const actionResults = await this.executeAiActions(answer);
    if (actionResults.length > 0) {
      // Strip actions block from visible answer
      answer = answer.replace(/<!--ACTIONS[\s\S]*?ACTIONS-->/g, '').trim();
      const resultText = actionResults.map((r) => `${r.success ? '✓' : '✗'} ${r.message}`).join('\n');
      answer += `\n\nKết quả thực thi:\n${resultText}`;
    }

    // Save to DB
    if (userId) {
      await prisma.aiChatMessage.createMany({
        data: [
          { user_id: userId, role: 'user', content: question },
          { user_id: userId, role: 'ai', content: answer },
        ],
      });
    }

    return { question, answer, messages_analyzed: messages.length };
  }

  // Parse and execute AI actions
  private static async executeAiActions(answer: string): Promise<Array<{ success: boolean; message: string }>> {
    const match = answer.match(/<!--ACTIONS\s*([\s\S]*?)\s*ACTIONS-->/);
    if (!match) return [];

    let actions: any[];
    try {
      actions = JSON.parse(match[1]);
    } catch {
      logger.warn('AI returned invalid actions JSON');
      return [];
    }

    const results: Array<{ success: boolean; message: string }> = [];

    for (const action of actions) {
      try {
        if (action.type === 'create_customer') {
          const d = action.data;
          // Check if customer already exists by company_name OR contact_name
          const searchName = d.company_name || d.contact_name || '';
          const existing = await prisma.customer.findFirst({
            where: {
              is_active: true,
              OR: [
                { company_name: { contains: searchName, mode: 'insensitive' as const } },
                { contact_name: { contains: searchName, mode: 'insensitive' as const } },
                ...(d.contact_name ? [{ contact_name: { contains: d.contact_name, mode: 'insensitive' as const } }] : []),
              ],
            },
          });
          if (existing) {
            results.push({ success: true, message: t("aiAction.customerExists", { name: existing.company_name }) });
            continue;
          }
          // Auto-detect customer type if not specified
          let customerType = d.customer_type || 'INDIVIDUAL';
          if (!d.customer_type) {
            const name = (d.company_name || d.contact_name || '').toLowerCase();
            if (/công ty|tnhh|cp |cổ phần/.test(name)) customerType = 'BUSINESS';
            else if (/cơ sở|cửa hàng|shop|quán/.test(name)) customerType = 'BUSINESS';
            else if (/đại lý/.test(name)) customerType = 'BUSINESS';
          }

          const customer = await prisma.customer.create({
            data: {
              company_name: d.company_name || d.contact_name,
              contact_name: d.contact_name || d.company_name,
              phone: d.phone || '',
              email: d.email || '',
              tax_code: d.tax_code || '',
              address: d.address || '',
              customer_type: customerType as any,
            },
          });
          results.push({ success: true, message: t("aiAction.customerCreated", { name: customer.company_name }) });

        } else if (action.type === 'create_order_suggestion') {
          const d = action.data;
          // Match products
          const products = await prisma.product.findMany({ where: { is_active: true }, select: { id: true, name: true, sku: true, retail_price: true } });
          const matchedItems: any[] = [];
          for (const item of (d.items || [])) {
            const search = item.product_name.toLowerCase();
            const matched = products.find((p) =>
              p.name.toLowerCase().includes(search) || search.includes(p.name.toLowerCase()) ||
              p.sku.toLowerCase() === search,
            );
            if (matched) {
              matchedItems.push({
                product_id: matched.id,
                product_name: matched.name,
                quantity: item.quantity,
                unit_price: item.unit_price || Number(matched.retail_price) || 0,
              });
            }
          }

          await prisma.orderSuggestion.create({
            data: {
              sender_id: '',
              sender_name: d.sender_name || d.customer_name || '',
              message: d.message || '',
              ai_summary: `AI tạo theo yêu cầu`,
              customer_name: d.customer_name || '',
              customer_phone: d.customer_phone || null,
              delivery_note: d.delivery_note || null,
              extracted_items: d.items || [],
              matched_items: matchedItems,
              status: 'PENDING',
            },
          });
          results.push({ success: true, message: `Đã tạo đề xuất đơn hàng cho "${d.customer_name}" (${matchedItems.length} SP khớp) — chờ duyệt` });

        } else if (action.type === 'update_customer') {
          const d = action.data;
          const customer = await prisma.customer.findFirst({
            where: { company_name: { contains: d.customer_name, mode: 'insensitive' }, is_active: true },
          });
          if (!customer) { results.push({ success: false, message: t("aiAction.customerNotFound", { name: d.customer_name }) }); continue; }

          const updates: any = {};
          if (d.updates?.tax_code) updates.tax_code = d.updates.tax_code;
          if (d.updates?.address) updates.address = d.updates.address;
          if (d.updates?.phone) updates.phone = d.updates.phone;
          if (d.updates?.email) updates.email = d.updates.email;
          if (d.updates?.contact_name) updates.contact_name = d.updates.contact_name;
          if (d.updates?.company_name) updates.company_name = d.updates.company_name;

          if (Object.keys(updates).length === 0) { results.push({ success: false, message: t("aiAction.noUpdateData") }); continue; }

          await prisma.customer.update({ where: { id: customer.id }, data: updates });
          const fields = Object.keys(updates).join(', ');
          results.push({ success: true, message: t("aiAction.customerUpdated", { fields, name: customer.company_name }) });

        } else if (action.type === 'update_sales_order') {
          const d = action.data;
          const order = await prisma.salesOrder.findFirst({
            where: { order_code: { contains: d.order_code, mode: 'insensitive' } },
          });
          if (!order) { results.push({ success: false, message: t("aiAction.orderNotFound", { code: d.order_code }) }); continue; }

          const updates: any = {};
          if (d.updates?.notes) updates.notes = d.updates.notes;
          if (d.updates?.expected_delivery) updates.expected_delivery = new Date(d.updates.expected_delivery);

          if (Object.keys(updates).length === 0) { results.push({ success: false, message: t("aiAction.noUpdateData") }); continue; }

          await prisma.salesOrder.update({ where: { id: order.id }, data: updates });
          results.push({ success: true, message: t("aiAction.salesOrderUpdated", { code: order.order_code }) });

        } else if (action.type === 'create_sales_order') {
          const d = action.data;
          // Resolve customer (search by company_name AND contact_name)
          let customerId: string | null = null;
          if (d.customer_name) {
            const existing = await prisma.customer.findFirst({
              where: {
                is_active: true,
                OR: [
                  { company_name: { contains: d.customer_name, mode: 'insensitive' as const } },
                  { contact_name: { contains: d.customer_name, mode: 'insensitive' as const } },
                ],
              },
            });
            if (existing) {
              customerId = existing.id;
            } else {
              const custName = (d.customer_name || '').toLowerCase();
              const autoType = /công ty|tnhh|cp |cổ phần/.test(custName) ? 'BUSINESS'
                : /cơ sở|cửa hàng|shop|quán/.test(custName) ? 'RETAIL'
                : /đại lý/.test(custName) ? 'BUSINESS' : 'INDIVIDUAL';
              const newCust = await prisma.customer.create({
                data: {
                  company_name: d.customer_name,
                  contact_name: d.contact_name || d.customer_name,
                  phone: d.phone || '',
                  tax_code: d.tax_code || '',
                  address: d.address || '',
                  customer_type: autoType as any,
                },
              });
              customerId = newCust.id;
              results.push({ success: true, message: t("aiAction.customerCreated", { name: newCust.company_name }) });
            }
          }
          if (!customerId) { results.push({ success: false, message: t("aiAction.missingCustomerInfo") }); continue; }

          // Match products + suppliers
          const products = await prisma.product.findMany({
            where: { is_active: true },
            select: { id: true, name: true, sku: true, retail_price: true },
          });
          const supplierPrices = await prisma.supplierPrice.findMany({
            include: { supplier: { select: { id: true, company_name: true } } },
          });
          const orderItems: any[] = [];
          for (const item of (d.items || [])) {
            const search = (item.product_name || '').toLowerCase();
            const matched = products.find((p) =>
              p.name.toLowerCase().includes(search) || search.includes(p.name.toLowerCase()) || p.sku.toLowerCase() === search,
            );
            if (matched) {
              // Match supplier: AI cung cấp tên NCC hoặc tìm preferred
              let supplierId: string | null = null;
              let purchasePrice: number | null = null;
              if (item.supplier_name) {
                const sp = supplierPrices.find((s) =>
                  s.product_id === matched.id && s.supplier.company_name.toLowerCase().includes((item.supplier_name || '').toLowerCase())
                );
                if (sp) { supplierId = sp.supplier_id; purchasePrice = sp.purchase_price; }
              }
              if (!supplierId) {
                // Fallback: preferred supplier
                const preferred = supplierPrices.find((s) => s.product_id === matched.id && s.is_preferred);
                const any = supplierPrices.find((s) => s.product_id === matched.id);
                const sp = preferred || any;
                if (sp) { supplierId = sp.supplier_id; purchasePrice = sp.purchase_price; }
              }
              orderItems.push({
                product_id: matched.id,
                supplier_id: supplierId,
                quantity: item.quantity,
                unit_price: item.unit_price || Number(matched.retail_price) || 0,
                purchase_price: purchasePrice,
                customer_product_name: item.product_name || undefined,
              });
            }
          }
          if (orderItems.length === 0) { results.push({ success: false, message: t("aiAction.noProductMatch") }); continue; }

          const so = await SalesOrderService.create({
            customer_id: customerId,
            status: 'DRAFT' as any,
            vat_rate: (d.vat_rate || 'VAT_10') as VATRate,
            expected_delivery: d.delivery_date || dayjs().add(7, 'day').format('YYYY-MM-DD'),
            notes: d.notes || `[AI] ${d.customer_name}`,
            items: orderItems,
          });
          results.push({ success: true, message: t("aiAction.salesOrderCreated", { code: so.order_code, count: orderItems.length, total: so.grand_total.toLocaleString() }) });

        } else if (action.type === 'create_purchase_order') {
          const d = action.data;
          // Find supplier
          let supplierId: string | null = null;
          if (d.supplier_name) {
            const supplier = await prisma.supplier.findFirst({
              where: { company_name: { contains: d.supplier_name, mode: 'insensitive' }, is_active: true },
            });
            if (supplier) supplierId = supplier.id;
          }
          if (!supplierId) { results.push({ success: false, message: t("aiAction.supplierNotFound", { name: d.supplier_name }) }); continue; }

          // Match products with supplier prices
          const supplierPrices = await prisma.supplierPrice.findMany({
            where: { supplier_id: supplierId },
            include: { product: { select: { id: true, name: true, sku: true } } },
          });
          const poItems: any[] = [];
          for (const item of (d.items || [])) {
            const search = (item.product_name || '').toLowerCase();
            const matched = supplierPrices.find((sp) =>
              sp.product.name.toLowerCase().includes(search) || search.includes(sp.product.name.toLowerCase()),
            );
            if (matched) {
              poItems.push({
                product_id: matched.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price || matched.purchase_price,
              });
            }
          }
          if (poItems.length === 0) { results.push({ success: false, message: t("aiAction.noProductMatchSupplier") }); continue; }

          const po = await PurchaseOrderService.create({
            supplier_id: supplierId,
            status: 'PENDING' as any,
            expected_delivery: d.delivery_date || dayjs().add(7, 'day').format('YYYY-MM-DD'),
            notes: d.notes || `[AI] Mua cho ${d.supplier_name}`,
            items: poItems,
          });
          results.push({ success: true, message: t("aiAction.purchaseOrderCreated", { code: po.order_code, supplier: d.supplier_name, count: poItems.length, total: po.total.toLocaleString() }) });

        } else if (action.type === 'delete_customer') {
          const d = action.data;
          const customer = await prisma.customer.findFirst({ where: { company_name: { contains: d.customer_name, mode: 'insensitive' }, is_active: true } });
          if (!customer) { results.push({ success: false, message: t("aiAction.customerNotFound", { name: d.customer_name }) }); continue; }
          await prisma.customer.update({ where: { id: customer.id }, data: { is_active: false } });
          results.push({ success: true, message: t("aiAction.customerDeleted", { name: customer.company_name }) });

        } else if (action.type === 'create_supplier') {
          const d = action.data;
          const existing = await prisma.supplier.findFirst({ where: { company_name: { contains: d.company_name, mode: 'insensitive' }, is_active: true } });
          if (existing) { results.push({ success: true, message: t("aiAction.supplierExists", { name: d.company_name }) }); continue; }
          const supplier = await prisma.supplier.create({
            data: {
              company_name: d.company_name, contact_name: d.contact_name || '', phone: d.phone || '',
              email: d.email || '', tax_code: d.tax_code || '', address: d.address || '',
              payment_terms: d.payment_terms || 'NET_30',
            },
          });
          results.push({ success: true, message: t("aiAction.supplierCreated", { name: supplier.company_name }) });

        } else if (action.type === 'update_supplier') {
          const d = action.data;
          const supplier = await prisma.supplier.findFirst({ where: { company_name: { contains: d.supplier_name, mode: 'insensitive' }, is_active: true } });
          if (!supplier) { results.push({ success: false, message: t("aiAction.supplierNotFound", { name: d.supplier_name }) }); continue; }
          const u = d.updates || {};
          const updates: any = {};
          for (const k of ['company_name', 'contact_name', 'phone', 'email', 'tax_code', 'address', 'payment_terms']) {
            if (u[k] !== undefined) updates[k] = u[k];
          }
          if (Object.keys(updates).length === 0) { results.push({ success: false, message: t("aiAction.noUpdateData") }); continue; }
          await prisma.supplier.update({ where: { id: supplier.id }, data: updates });
          results.push({ success: true, message: t("aiAction.supplierUpdated", { name: supplier.company_name }) });

        } else if (action.type === 'update_order_status') {
          const d = action.data;
          const code = d.order_code || '';
          if (code.startsWith('SO')) {
            const order = await prisma.salesOrder.findFirst({ where: { order_code: code } });
            if (!order) { results.push({ success: false, message: t("aiAction.orderNotFound", { code }) }); continue; }
            await SalesOrderService.updateStatus(order.id, d.status);
            results.push({ success: true, message: t("aiAction.statusChanged", { code, status: d.status }) });
          } else if (code.startsWith('PO')) {
            const order = await prisma.purchaseOrder.findFirst({ where: { order_code: code } });
            if (!order) { results.push({ success: false, message: t("aiAction.orderNotFound", { code }) }); continue; }
            await PurchaseOrderService.updateStatus(order.id, d.status);
            results.push({ success: true, message: t("aiAction.statusChanged", { code, status: d.status }) });
          } else {
            results.push({ success: false, message: t("aiAction.invalidOrderCode", { code }) });
          }

        } else if (action.type === 'update_purchase_order') {
          const d = action.data;
          const order = await prisma.purchaseOrder.findFirst({ where: { order_code: { contains: d.order_code, mode: 'insensitive' } } });
          if (!order) { results.push({ success: false, message: t("aiAction.orderNotFound", { code: d.order_code }) }); continue; }
          const updates: any = {};
          if (d.updates?.notes) updates.notes = d.updates.notes;
          if (d.updates?.expected_delivery) updates.expected_delivery = new Date(d.updates.expected_delivery);
          await prisma.purchaseOrder.update({ where: { id: order.id }, data: updates });
          results.push({ success: true, message: t("aiAction.purchaseOrderUpdated", { code: order.order_code }) });

        } else if (action.type === 'create_invoice') {
          const d = action.data;
          const so = await prisma.salesOrder.findFirst({ where: { order_code: { contains: d.order_code, mode: 'insensitive' } } });
          if (!so) { results.push({ success: false, message: t("aiAction.invoiceNotFound", { code: d.order_code }) }); continue; }
          const invoice = await InvoiceService.createFromOrder(so.id);
          results.push({ success: true, message: t("aiAction.invoiceCreated", { number: invoice.invoice_number, code: so.order_code }) });

        } else if (action.type === 'finalize_invoice') {
          const d = action.data;
          const so = await prisma.salesOrder.findFirst({ where: { order_code: { contains: d.order_code, mode: 'insensitive' } } });
          if (!so) { results.push({ success: false, message: t("aiAction.invoiceNotFound", { code: d.order_code }) }); continue; }
          const invoice = await prisma.invoice.findFirst({ where: { sales_order_id: so.id, status: 'DRAFT' } });
          if (!invoice) { results.push({ success: false, message: t("aiAction.noDraftInvoice", { code: d.order_code }) }); continue; }
          await InvoiceService.finalize(invoice.id);
          results.push({ success: true, message: t("aiAction.invoiceFinalized", { number: invoice.invoice_number }) });

        } else if (action.type === 'record_payment') {
          const d = action.data;
          const code = d.order_code || '';
          if (d.type === 'receivable') {
            const rec = await prisma.receivable.findFirst({ where: { sales_order: { order_code: code } }, include: { sales_order: true } });
            if (!rec) { results.push({ success: false, message: t("aiAction.debtNotFound", { code }) }); continue; }
            await prisma.$transaction(async (tx) => {
              await tx.receivablePayment.create({ data: { receivable_id: rec.id, amount: d.amount, payment_date: new Date(), method: d.method || 'BANK_TRANSFER', reference: d.reference || '' } });
              const newPaid = Number(rec.paid_amount) + d.amount;
              const newRemaining = Number(rec.original_amount) - newPaid;
              await tx.receivable.update({ where: { id: rec.id }, data: { paid_amount: newPaid, remaining: Math.max(0, newRemaining), status: newRemaining <= 0 ? 'PAID' : 'PARTIAL' } });
            });
            results.push({ success: true, message: t("aiAction.paymentRecorded", { amount: d.amount.toLocaleString(), code }) });
          } else {
            const pay = await prisma.payable.findFirst({ where: { purchase_order: { order_code: code } }, include: { purchase_order: true } });
            if (!pay) { results.push({ success: false, message: t("aiAction.debtNotFound", { code }) }); continue; }
            await prisma.$transaction(async (tx) => {
              await tx.payablePayment.create({ data: { payable_id: pay.id, amount: d.amount, payment_date: new Date(), method: d.method || 'BANK_TRANSFER', reference: d.reference || '' } });
              const newPaid = Number(pay.paid_amount) + d.amount;
              const newRemaining = Number(pay.original_amount) - newPaid;
              await tx.payable.update({ where: { id: pay.id }, data: { paid_amount: newPaid, remaining: Math.max(0, newRemaining), status: newRemaining <= 0 ? 'PAID' : 'PARTIAL' } });
            });
            results.push({ success: true, message: t("aiAction.paymentRecorded", { amount: d.amount.toLocaleString(), code }) });
          }

        } else if (action.type === 'create_product') {
          const d = action.data;
          const existing = await prisma.product.findFirst({ where: { name: { contains: d.name, mode: 'insensitive' }, is_active: true } });
          if (existing) { results.push({ success: true, message: t("aiAction.productExists", { name: d.name }) }); continue; }
          let categoryId = null;
          if (d.category_name) {
            const cat = await prisma.category.findFirst({ where: { name: { contains: d.category_name, mode: 'insensitive' } } });
            if (cat) categoryId = cat.id;
            else {
              const newCat = await prisma.category.create({ data: { name: d.category_name } });
              categoryId = newCat.id;
            }
          }
          const sku = d.sku || `SP-${Date.now().toString(36).toUpperCase()}`;
          const product = await prisma.product.create({
            data: {
              sku, name: d.name, category_id: categoryId, description: d.description || '',
              material: d.material || null, retail_price: d.retail_price || null,
              moq: d.moq || null,
            },
          });
          results.push({ success: true, message: t("aiAction.productCreated", { name: product.name, sku: product.sku }) });

        } else if (action.type === 'update_product') {
          const d = action.data;
          const product = await prisma.product.findFirst({ where: { name: { contains: d.product_name, mode: 'insensitive' }, is_active: true } });
          if (!product) { results.push({ success: false, message: t("aiAction.productNotFound", { name: d.product_name }) }); continue; }
          const u = d.updates || {};
          const updates: any = {};
          for (const k of ['retail_price', 'moq', 'description', 'name']) {
            if (u[k] !== undefined) updates[k] = u[k];
          }
          await prisma.product.update({ where: { id: product.id }, data: updates });
          results.push({ success: true, message: t("aiAction.productUpdated", { name: product.name }) });

        } else if (action.type === 'update_supplier_price') {
          const d = action.data;
          const supplier = await prisma.supplier.findFirst({ where: { company_name: { contains: d.supplier_name, mode: 'insensitive' }, is_active: true } });
          const product = await prisma.product.findFirst({ where: { name: { contains: d.product_name, mode: 'insensitive' }, is_active: true } });
          if (!supplier || !product) { results.push({ success: false, message: t("aiAction.supplierPriceNotFound") }); continue; }
          const u = d.updates || {};
          await prisma.supplierPrice.upsert({
            where: { supplier_id_product_id: { supplier_id: supplier.id, product_id: product.id } },
            update: { ...(u.purchase_price && { purchase_price: u.purchase_price }), ...(u.moq && { moq: u.moq }), ...(u.lead_time_days && { lead_time_days: u.lead_time_days }), ...(u.stock_quantity !== undefined && { stock_quantity: u.stock_quantity }) },
            create: { supplier_id: supplier.id, product_id: product.id, purchase_price: u.purchase_price || 0, moq: u.moq, lead_time_days: u.lead_time_days, stock_quantity: u.stock_quantity || 0 },
          });
          results.push({ success: true, message: t("aiAction.supplierPriceUpdated", { supplier: supplier.company_name, product: product.name }) });

        } else if (action.type === 'mark_debt_paid') {
          const d = action.data;
          const code = d.order_code || '';
          if (d.type === 'receivable') {
            const rec = await prisma.receivable.findFirst({ where: { sales_order: { order_code: code } } });
            if (!rec) { results.push({ success: false, message: t("aiAction.debtNotFound", { code }) }); continue; }
            await prisma.receivable.update({
              where: { id: rec.id },
              data: { paid_amount: rec.original_amount, remaining: 0, status: 'PAID' },
            });
            results.push({ success: true, message: t("aiAction.debtMarkedPaid", { code }) });
          } else {
            const pay = await prisma.payable.findFirst({ where: { purchase_order: { order_code: code } } });
            if (!pay) { results.push({ success: false, message: t("aiAction.debtNotFound", { code }) }); continue; }
            await prisma.payable.update({
              where: { id: pay.id },
              data: { paid_amount: pay.original_amount, remaining: 0, status: 'PAID' },
            });
            results.push({ success: true, message: t("aiAction.debtMarkedPaid", { code }) });
          }

        } else if (action.type === 'update_po_status') {
          const d = action.data;
          const code = d.order_code || '';
          const order = await prisma.purchaseOrder.findFirst({ where: { order_code: { contains: code, mode: 'insensitive' } } });
          if (!order) { results.push({ success: false, message: t("aiAction.orderNotFound", { code }) }); continue; }
          await PurchaseOrderService.updateStatus(order.id, d.status);
          if (d.note) {
            await prisma.purchaseOrder.update({ where: { id: order.id }, data: { notes: d.note } });
          }
          results.push({ success: true, message: t("aiAction.poStatusUpdated", { code: order.order_code, status: d.status }) });

        } else if (action.type === 'create_alert') {
          const d = action.data;
          const relatedPO = d.related_entity?.startsWith('PO')
            ? await prisma.purchaseOrder.findFirst({ where: { order_code: { contains: d.related_entity, mode: 'insensitive' } } })
            : null;
          await prisma.alert.create({
            data: {
              type: d.type || 'WARNING',
              title: d.title || 'Cảnh báo từ NCC',
              message: d.message || '',
              purchase_order_id: relatedPO?.id || null,
            },
          });
          results.push({ success: true, message: t("aiAction.alertCreated", { title: d.title }) });

        } else if (action.type === 'get_report') {
          const d = action.data;
          results.push({ success: true, message: t("aiAction.reportInfo", { type: d.type, from: d.from_date || "-", to: d.to_date || "-" }) });

        } else {
          results.push({ success: false, message: t("aiAction.unsupportedAction", { type: action.type }) });
        }
      } catch (err: any) {
        results.push({ success: false, message: t("aiAction.actionError", { type: action.type, message: err.message }) });
      }
    }

    return results;
  }

  static async getChatHistory(userId: string, limit: number = 200) {
    return prisma.aiChatMessage.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
      take: limit,
    });
  }

  static async clearChatHistory(userId: string) {
    const { count } = await prisma.aiChatMessage.deleteMany({ where: { user_id: userId } });
    return { deleted: count };
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
      return { summary: t('zalo.noMessagesInPeriod'), messages_analyzed: 0 };
    }

    const reversed = [...messages].reverse();
    const result = await AIService.summarizeMessages(reversed);
    return { ...result, messages_analyzed: messages.length, period_hours: hours };
  }
}
