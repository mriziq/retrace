import { afterEach, expect, it, vi } from "vitest";
import { runOtherChat } from "./chatProviders";
import type { FunctionDeclaration } from "./geminiChat";

const declarations: FunctionDeclaration[] = [{
  name: "searchHistory",
  description: "Search browsing history",
  parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] },
}];
const executors = { searchHistory: vi.fn(async () => [{ title: "Result", url: "https://example.com" }]) };
const onStatus = vi.fn();
const json = (body: object) => ({ ok: true, json: async () => body }) as Response;

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
