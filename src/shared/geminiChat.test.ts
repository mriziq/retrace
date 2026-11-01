import { afterEach, expect, it, vi } from "vitest";
import { runChat } from "./geminiChat";

const event = (parts: object[], trailingNewline = true) =>
  new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts } }] })}${trailingNewline ? "\n\n" : ""}`);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("finishes a Gemini tool call at the round limit and reads the final SSE line", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(event([{ functionCall: { name: "searchHistory", args: { query: "article" } } }]))
    .mockResolvedValueOnce(event([{ text: "Found it." }], false));
  vi.stubGlobal("fetch", fetchMock);
  const onChunk = vi.fn();
  const executor = vi.fn(async () => [{ url: "https://example.com" }]);

  const history = await runChat("key", "gemini-custom", "Find article", [], "system", [
    { name: "searchHistory", description: "Search history", parameters: { type: "OBJECT", properties: {} } },
  ], { searchHistory: executor }, onChunk, 0);

  expect(fetchMock.mock.calls[0][0]).toContain("gemini-custom:streamGenerateContent");
  expect(fetchMock.mock.calls[0][0]).not.toContain("key=");
  expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("key");
  expect(executor).toHaveBeenCalledWith({ query: "article" });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).tools).toBeUndefined();
  expect(history.map((item) => item.role)).toEqual(["user", "model", "user", "model"]);
  expect(onChunk).toHaveBeenCalledWith("Found it.");
});

it("reports a Gemini SSE error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('data: {"error":{"message":"Quota exceeded"}}\n\n')));
  await expect(runChat("key", "gemini-custom", "Hi", [], "system", [], {}, vi.fn()))
    .rejects.toThrow("Quota exceeded");
});
