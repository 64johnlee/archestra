import type { ModelMessage } from "ai";
import { describe, expect, test } from "vitest";
import {
  buildCompactionPrompt,
  DEFAULT_COMPACTION_TOKEN_THRESHOLD,
  estimateTokenCount,
  shouldCompact,
} from "./context-compaction";

const msg = (role: ModelMessage["role"], content: string): ModelMessage =>
  ({ role, content }) as ModelMessage;

describe("estimateTokenCount", () => {
  test("returns 0 for empty array", () => {
    expect(estimateTokenCount([])).toBe(0);
  });

  test("estimates based on content length / 4", () => {
    const messages = [msg("user", "a".repeat(400))];
    expect(estimateTokenCount(messages)).toBeGreaterThanOrEqual(100);
  });

  test("sums across multiple messages", () => {
    const single = [msg("user", "a".repeat(400))];
    const double = [
      msg("user", "a".repeat(400)),
      msg("assistant", "b".repeat(400)),
    ];
    expect(estimateTokenCount(double)).toBeGreaterThan(
      estimateTokenCount(single),
    );
  });
});

describe("shouldCompact", () => {
  test("returns false for short conversation", () => {
    expect(shouldCompact([msg("user", "hello")])).toBe(false);
  });

  test("returns true when over default threshold", () => {
    const bigMessages = [
      msg(
        "user",
        "a".repeat(DEFAULT_COMPACTION_TOKEN_THRESHOLD * 4 + 100),
      ),
    ];
    expect(shouldCompact(bigMessages)).toBe(true);
  });

  test("respects custom threshold", () => {
    const messages = [msg("user", "a".repeat(40))];
    expect(shouldCompact(messages, 5)).toBe(true);
    expect(shouldCompact(messages, 1000)).toBe(false);
  });

  test("returns false for empty messages", () => {
    expect(shouldCompact([])).toBe(false);
  });
});

describe("buildCompactionPrompt", () => {
  test("includes user and assistant turns", () => {
    const prompt = buildCompactionPrompt([
      msg("user", "hello"),
      msg("assistant", "world"),
    ]);
    expect(prompt).toContain("User: hello");
    expect(prompt).toContain("Assistant: world");
  });

  test("includes prior summary when provided", () => {
    const prompt = buildCompactionPrompt(
      [msg("user", "hi")],
      "prior context here",
    );
    expect(prompt).toContain("Prior summary");
    expect(prompt).toContain("prior context here");
  });

  test("omits prior summary section when not provided", () => {
    const prompt = buildCompactionPrompt([msg("user", "hi")]);
    expect(prompt).not.toContain("Prior summary");
  });

  test("handles non-string message content", () => {
    const m = {
      role: "user" as const,
      content: [{ type: "text", text: "structured" }],
    } as ModelMessage;
    const prompt = buildCompactionPrompt([m]);
    expect(prompt).toContain("User:");
  });

  test("includes summarize instruction", () => {
    const prompt = buildCompactionPrompt([msg("user", "hi")]);
    expect(prompt).toContain("Summarize");
  });
});
