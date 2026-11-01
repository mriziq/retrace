import { afterEach, expect, it, vi } from "vitest";
import { readChatSettings, runOtherChat } from "./chatProviders";
import type { FunctionDeclaration } from "./geminiChat";

const declarations: FunctionDeclaration[] = [{
  name: "searchHistory",
  description: "Search browsing history",
  parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] },
}];
const executors = { searchHistory: vi.fn(async () => [{ title: "Result", url: "https://example.com" }]) };
const onStatus = vi.fn();
const json = (body: object) => ({ ok: true, json: async () => body }) as Response;

it("restores per-provider models and migrates older saved settings", () => {
  const migrated = readChatSettings({ provider: "anthropic", model: "claude-custom", openaiApiKey: "openai-key" });
  expect(migrated.models.anthropic).toBe("claude-custom");
  expect(migrated.models.openai).toBe("gpt-6-luna");
  expect(migrated.openaiApiKey).toBe("openai-key");
  expect(readChatSettings({ provider: "invalid", models: { openai: "gpt-custom" } })).toMatchObject({
    provider: "gemini", models: { openai: "gpt-custom", anthropic: "claude-sonnet-4-6" },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("passes OpenAI function results back before returning the answer", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(json({ output: [{ type: "function_call", call_id: "call_1", name: "searchHistory", arguments: '{"query":"article"}' }] }))
    .mockResolvedValueOnce(json({ output: [{ type: "message", content: [{ type: "output_text", text: "Found it." }] }] }));
  vi.stubGlobal("fetch", fetchMock);
  const onText = vi.fn();

  const history = await runOtherChat("openai", "gpt-test", "key", "Find article", [], "system", declarations, executors, onText, onStatus);

  expect(executors.searchHistory).toHaveBeenCalledWith({ query: "article" });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).input).toContainEqual({
    type: "function_call_output", call_id: "call_1", output: JSON.stringify([{ title: "Result", url: "https://example.com" }]),
  });
  expect(history[history.length - 1]).toEqual({ role: "assistant", content: "Found it." });
  expect(onText).toHaveBeenCalledWith("Found it.");
});

it("uses the final OpenAI answer after a tool call and rejects incomplete responses", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(json({ output: [
      { type: "message", content: [{ type: "output_text", text: "Searching..." }] },
      { type: "function_call", call_id: "call_1", name: "searchHistory", arguments: '{"query":"article"}' },
    ] }))
    .mockResolvedValueOnce(json({ output: [{ type: "message", content: [{ type: "output_text", text: "Found it." }] }] }));
  vi.stubGlobal("fetch", fetchMock);
  const onText = vi.fn();

  await runOtherChat("openai", "gpt-test", "key", "Find article", [], "system", declarations, executors, onText, onStatus);
  expect(onText).toHaveBeenCalledWith("Found it.");

  fetchMock.mockReset().mockResolvedValue(json({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }));
  await expect(runOtherChat("openai", "gpt-test", "key", "Find article", [], "system", declarations, executors, onText, onStatus))
    .rejects.toThrow("max_output_tokens");
});

it("passes Anthropic tool results back before returning the answer", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(json({ content: [{ type: "tool_use", id: "tool_1", name: "searchHistory", input: { query: "article" } }] }))
    .mockResolvedValueOnce(json({ content: [{ type: "text", text: "Found it." }] }));
  vi.stubGlobal("fetch", fetchMock);

  const history = await runOtherChat("anthropic", "claude-test", "key", "Find article", [], "system", declarations, executors, vi.fn(), onStatus);

  expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages.at(-1).content).toEqual([{
    type: "tool_result", tool_use_id: "tool_1", content: JSON.stringify([{ title: "Result", url: "https://example.com" }]),
  }]);
  expect(history[history.length - 1]).toEqual({ role: "assistant", content: "Found it." });
});

it("reports an Anthropic output limit instead of returning a partial answer", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ stop_reason: "max_tokens", content: [{ type: "text", text: "Partial" }] })));
  await expect(runOtherChat("anthropic", "claude-test", "key", "Question", [], "system", declarations, executors, vi.fn(), onStatus))
    .rejects.toThrow("output limit");
});
