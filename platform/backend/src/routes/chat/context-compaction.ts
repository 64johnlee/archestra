import type { ModelMessage } from "ai";
import { generateText } from "ai";
import logger from "@/logging";

const CHARS_PER_TOKEN = 4;
export const DEFAULT_COMPACTION_TOKEN_THRESHOLD = 60_000;
const MIN_RECENT_MESSAGES = 10;

export interface CompactionResult {
  messages: ModelMessage[];
  summary: string;
}

export interface CompactMessagesParams {
  messages: ModelMessage[];
  model: Parameters<typeof generateText>[0]["model"];
  threshold?: number;
  existingSummary?: string | null;
}

export function estimateTokenCount(messages: ModelMessage[]): number {
  return Math.ceil(
    messages.reduce((sum, m) => sum + JSON.stringify(m.content).length, 0) /
      CHARS_PER_TOKEN,
  );
}

export function shouldCompact(
  messages: ModelMessage[],
  threshold = DEFAULT_COMPACTION_TOKEN_THRESHOLD,
): boolean {
  return estimateTokenCount(messages) > threshold;
}

export function buildCompactionPrompt(
  messagesToSummarize: ModelMessage[],
  existingSummary?: string | null,
): string {
  const transcript = messagesToSummarize
    .map((m) => {
      const role = m.role === "assistant" ? "Assistant" : "User";
      const text =
        typeof m.content === "string"
          ? m.content
          : JSON.stringify(m.content);
      return `${role}: ${text}`;
    })
    .join("\n\n");

  const priorContext = existingSummary
    ? `Prior summary:\n${existingSummary}\n\n`
    : "";

  return (
    `${priorContext}Summarize the following conversation segment concisely, ` +
    `preserving key decisions, facts, and context needed to continue the conversation:\n\n` +
    transcript
  );
}

export async function compactMessages(
  params: CompactMessagesParams,
): Promise<CompactionResult | null> {
  const {
    messages,
    model,
    threshold = DEFAULT_COMPACTION_TOKEN_THRESHOLD,
    existingSummary,
  } = params;

  if (!shouldCompact(messages, threshold)) return null;

  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  if (nonSystem.length <= MIN_RECENT_MESSAGES) return null;

  const toSummarize = nonSystem.slice(0, -MIN_RECENT_MESSAGES);
  const recent = nonSystem.slice(-MIN_RECENT_MESSAGES);

  const prompt = buildCompactionPrompt(toSummarize, existingSummary);

  try {
    const result = await generateText({ model, prompt });
    const summary = result.text.trim();

    const summaryMessage: ModelMessage = {
      role: "system",
      content: `[Earlier conversation summary]\n${summary}`,
    };

    logger.info(
      { messageCount: messages.length, summarizedCount: toSummarize.length },
      "Context compaction succeeded",
    );

    return {
      messages: [...systemMessages, summaryMessage, ...recent],
      summary,
    };
  } catch (error) {
    logger.error(
      { error },
      "Context compaction failed, continuing without compaction",
    );
    return null;
  }
}
