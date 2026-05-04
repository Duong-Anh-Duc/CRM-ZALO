import OpenAI from 'openai';
import { config } from '../../config';
import logger from '../../utils/logger';
import { openai } from './chatbot/openai-client';
import { toolRegistry } from './chatbot/tool-registry';
import { registerAllTools } from './chatbot/tools';
import { getSystemContext } from './chatbot/system-context';
import { AURA_STATIC_PROMPT, buildAuraDynamicContext } from './chatbot/prompts/aura-system';
import { stripMarkdown, stripMarkdownStream } from './chatbot/text-utils';
import { customerReply } from './chatbot/customer-reply';
import { identifyProductFromImage, ProductImageAttrs } from './chatbot/vision';
import { ToolContext } from './chatbot/types';
import { recordTelemetry, UsageCollector } from './chatbot/telemetry';
import { compressHistory } from './chatbot/history';
import { loadRelevantMemories } from './chatbot/memory';
import { extractMemoriesAsync } from './chatbot/memory-extractor';
import { selectDomains } from './chatbot/tool-router';
import { allToolNames, expandDomains } from './chatbot/tool-domains';

registerAllTools();

const MAX_ROUNDS = 5;

export interface ChatUser {
  id: string;
  email?: string;
  role?: string;
  roleSlug?: string;
}

function toolCallSignature(message: OpenAI.Chat.ChatCompletionMessage): string {
  if (!message.tool_calls) return '';
  return JSON.stringify(
    message.tool_calls.map((tc) => {
      const fn = (tc as any).function;
      return { name: fn?.name, args: fn?.arguments };
    }),
  );
}

export class ChatbotService {
  /**
   * Chat with function calling + streaming. Optional image attachments are sent
   * to the vision model so Aura can "see" invoices, product photos, etc.
   */
  static async *chatStream(
    question: string,
    history: Array<{ role: string; content: string }> = [],
    attachments: Array<{ url: string; type: 'image' | 'file' }> = [],
    user?: ChatUser,
  ): AsyncGenerator<string> {
    const ctx: ToolContext = { user: user || { id: 'anonymous' } };
    const userId = ctx.user.id;
    const usage = new UsageCollector();
    const startedAt = Date.now();
    const imageUrls = attachments.filter((a) => a.type === 'image').map((a) => a.url);
    const hasImages = imageUrls.length > 0;
    const modelName = hasImages
      ? (config.openai.visionModel || config.openai.model || 'gpt-4o-mini')
      : (config.openai.model || 'gpt-4o-mini');
    let success = true;
    let errorMessage: string | undefined;
    const replyChunks: string[] = [];

    try {
      const [systemContext, userMemories, compressedHistory, selectedDomains] = await Promise.all([
        getSystemContext(),
        userId !== 'anonymous' ? loadRelevantMemories(userId, question) : Promise.resolve(''),
        compressHistory(history, modelName),
        selectDomains(question, history, hasImages),
      ]);

      const userContent: OpenAI.Chat.ChatCompletionUserMessageParam['content'] = hasImages
        ? [
            { type: 'text' as const, text: question },
            ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ]
        : question;

      const dynamicContext = userMemories
        ? `${buildAuraDynamicContext(systemContext)}\n\n${userMemories}`
        : buildAuraDynamicContext(systemContext);

      // Two system messages: static (cacheable prefix) + dynamic (date + ctx + memory).
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: AURA_STATIC_PROMPT },
        { role: 'system', content: dynamicContext },
        ...compressedHistory,
        { role: 'user', content: userContent },
      ];

      // Hierarchical tool routing: stage 1 picks domains; stage 2 only loads those tools.
      // On router failure (null) we fall back to all tools to keep behavior intact.
      const allowList = selectedDomains === null
        ? allToolNames()
        : expandDomains(selectedDomains);
      const tools = toolRegistry.schemas(allowList);
      logger.debug?.(`Aura tools loaded: ${tools.length} (domains: ${selectedDomains?.join(',') || 'ALL'})`);
      let prevSignature = '';

      for (let round = 0; round < MAX_ROUNDS; round++) {
        usage.incRound();
        let response: OpenAI.Chat.ChatCompletion | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            response = await openai.chat.completions.create({
              model: modelName,
              messages, tools, tool_choice: 'auto',
              temperature: 0.3, max_tokens: 1500,
            });
            if (response.choices && response.choices.length > 0) break;
            logger.warn(`Aura round ${round} attempt ${attempt}: empty choices`, { body: (response as any)?.msg });
          } catch (err: any) {
            logger.warn(`Aura round ${round} attempt ${attempt} threw:`, err?.message);
            response = null;
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
        if (!response || !response.choices || response.choices.length === 0) {
          yield 'Xin lỗi, dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau vài giây.';
          return;
        }
        usage.add(response.usage);
        const choice = response.choices[0];

        if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
          yield* tee(streamFinal(modelName, messages, usage), replyChunks);
          return;
        }

        // Convergence detection: stop if the model emits the exact same tool calls twice in a row.
        const signature = toolCallSignature(choice.message);
        if (signature && signature === prevSignature) {
          logger.warn(`Aura convergence: same tool calls repeated round ${round}, stopping early.`);
          messages.push(choice.message);
          // Acknowledge the stuck call so the final stream can proceed.
          for (const tc of choice.message.tool_calls) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: '⚠️ Đã gọi tool này ở round trước với cùng tham số. Dừng để tránh vòng lặp.',
            });
          }
          yield* tee(streamFinal(modelName, messages, usage), replyChunks);
          return;
        }
        prevSignature = signature;

        messages.push(choice.message);
        usage.incToolCalls(choice.message.tool_calls.length);
        for (const tc of choice.message.tool_calls) {
          const fn = (tc as any).function;
          let result: string;
          try {
            const args = JSON.parse(fn.arguments || '{}');
            result = await toolRegistry.execute(fn.name, args, ctx);
          } catch (err: any) {
            result = `❌ Lỗi khi gọi ${fn.name}: ${err?.message || 'unknown'}`;
            logger.error(`Tool ${fn.name} failed:`, err);
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
      }

      yield* tee(streamFinal(modelName, messages, usage), replyChunks);
    } catch (err: any) {
      success = false;
      errorMessage = err?.message || 'unknown';
      logger.error('Chatbot error:', err);
      yield 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.';
    } finally {
      recordTelemetry({
        ctx,
        channel: 'chat',
        model: modelName,
        rounds: usage.rounds,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        cachedTokens: usage.cachedTokens,
        totalTokens: usage.totalTokens,
        latencyMs: Date.now() - startedAt,
        toolCalls: usage.toolCalls,
        success,
        error: errorMessage,
      });
      if (success && userId !== 'anonymous' && replyChunks.length) {
        extractMemoriesAsync(userId, history, question, replyChunks.join(''));
      }
    }
  }

  /**
   * Non-streaming fallback
   */
  static async chat(
    question: string,
    history: Array<{ role: string; content: string }> = [],
    attachments: Array<{ url: string; type: 'image' | 'file' }> = [],
    user?: ChatUser,
  ): Promise<string> {
    let result = '';
    for await (const chunk of this.chatStream(question, history, attachments, user)) {
      result += chunk;
    }
    return result;
  }

  /**
   * Vision: extract packaging product attributes from image(s).
   */
  static async identifyProductFromImage(imageUrls: string | string[]): Promise<ProductImageAttrs> {
    return identifyProductFromImage(imageUrls);
  }

  /**
   * Customer-facing reply for Zalo auto-reply (read-only, shop-assistant persona).
   */
  static async customerReply(
    question: string,
    history: Array<{ role: string; content: string }> = [],
    customSystemPrompt?: string,
    imageUrls: string[] = [],
  ): Promise<string> {
    return customerReply(question, history, customSystemPrompt, imageUrls);
  }
}

async function* tee(
  source: AsyncGenerator<string>,
  sink: string[],
): AsyncGenerator<string> {
  for await (const chunk of source) {
    sink.push(chunk);
    yield chunk;
  }
}

async function* streamFinal(
  modelName: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  usage: UsageCollector,
): AsyncGenerator<string> {
  usage.incRound();
  let stream;
  try {
    stream = await openai.chat.completions.create({
      model: modelName,
      messages, temperature: 0.3, max_tokens: 1500, stream: true,
      stream_options: { include_usage: true },
    });
  } catch (err: any) {
    logger.error('streamFinal API error:', err?.message || err);
    yield 'Xin lỗi, không nhận được phản hồi. Vui lòng thử lại.';
    return;
  }
  let buf = '';
  try {
    for await (const chunk of stream) {
      if (chunk.usage) usage.add(chunk.usage);
      if (!chunk.choices || chunk.choices.length === 0) continue;
      const delta = chunk.choices[0]?.delta?.content;
      if (!delta) continue;
      buf += delta;
      const { safe, remainder } = stripMarkdownStream(buf);
      if (safe) yield safe;
      buf = remainder;
    }
  } catch (err: any) {
    logger.error('streamFinal stream error:', err?.message || err);
    if (!buf) yield 'Xin lỗi, lỗi khi nhận phản hồi.';
  }
  if (buf) yield stripMarkdown(buf);
}
