import type { FunctionDeclaration, ToolExecutors } from "./geminiChat";

export type ChatProvider = "gemini" | "openai" | "anthropic";
export const DEFAULT_MODELS: Record<ChatProvider, string> = {
  gemini: "gemini-3-flash-preview",
  openai: "gpt-6-luna",
  anthropic: "claude-sonnet-4-6",
};
export interface ChatSettings {
  provider: ChatProvider;
  models: Record<ChatProvider, string>;
  openaiApiKey: string;
  anthropicApiKey: string;
}

export interface TextMessage {
  role: "user" | "assistant";
  content: string;
}

export function readChatSettings(value: unknown): ChatSettings {
  const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const provider: ChatProvider = saved.provider === "openai" || saved.provider === "anthropic" ? saved.provider : "gemini";
  const savedModels = saved.models && typeof saved.models === "object" ? saved.models as Record<string, unknown> : {};
  const models = { ...DEFAULT_MODELS };
  for (const name of ["gemini", "openai", "anthropic"] as const) {
    if (typeof savedModels[name] === "string" && savedModels[name].trim()) models[name] = savedModels[name].trim();
  }
  if (typeof saved.model === "string" && saved.model.trim()) models[provider] = saved.model.trim();
  return {
    provider,
    models,
    openaiApiKey: typeof saved.openaiApiKey === "string" ? saved.openaiApiKey : "",
    anthropicApiKey: typeof saved.anthropicApiKey === "string" ? saved.anthropicApiKey : "",
  };
}

const toolLabels: Record<string, string> = {
  searchHistory: "searching your history",
  getRecentHistory: "checking recent pages",
};

function jsonSchema(parameters: Record<string, unknown>) {
  const properties = parameters.properties as Record<string, { type: string; description?: string }>;
  return {
    type: "object",
    properties: Object.fromEntries(Object.entries(properties).map(([name, value]) => [name, {
      ...value,
      type: value.type.toLowerCase(),
    }])),
    ...(parameters.required ? { required: parameters.required } : {}),
  };
}

async function postJson(url: string, key: string, provider: "openai" | "anthropic", body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: provider === "openai"
      ? { "Content-Type": "application/json", Authorization: `Bearer ${key}` }
      : {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(`${provider === "openai" ? "OpenAI" : "Anthropic"} ${response.status}: ${error?.error?.message ?? response.statusText}`);
  }
  return response.json();
}

export async function runOtherChat(
  provider: "openai" | "anthropic",
  model: string,
  apiKey: string,
  userText: string,
  history: TextMessage[],
  systemInstruction: string,
  declarations: FunctionDeclaration[],
  executors: ToolExecutors,
  onText: (text: string) => void,
  onStatus: (status: string | null) => void
): Promise<TextMessage[]> {
  const messages: TextMessage[] = [...history, { role: "user", content: userText }];
  const tools = declarations.map(({ name, description, parameters }) => ({ name, description, schema: jsonSchema(parameters) }));
  let finalText = "";

  if (provider === "openai") {
    const input: object[] = [...messages];
    for (let round = 0; round <= 3; round++) {
      onStatus("thinking");
      const result = await postJson("https://api.openai.com/v1/responses", apiKey, provider, {
        model, instructions: systemInstruction, input, store: false,
        tools: tools.map(({ name, description, schema }) => ({ type: "function", name, description, parameters: schema, strict: false })),
        ...(round === 3 ? { tool_choice: "none" } : {}),
      }) as { status?: string; incomplete_details?: { reason?: string }; output?: Array<Record<string, unknown>> };
      if (result.status === "incomplete" || result.status === "failed") {
        throw new Error(`OpenAI response ${result.status}${result.incomplete_details?.reason ? `: ${result.incomplete_details.reason}` : "."}`);
      }
      const output = result.output ?? [];
      input.push(...output);
      const calls = output.filter((item) => item.type === "function_call");
      finalText = "";
      for (const item of output) {
        if (item.type !== "message") continue;
        for (const part of (item.content as Array<{ type: string; text?: string; refusal?: string }> ?? [])) {
          if (part.type === "output_text" && part.text) finalText += part.text;
          if (part.type === "refusal" && part.refusal) finalText += part.refusal;
        }
      }
      if (!calls.length) break;
      if (round === 3 && calls.length) throw new Error("OpenAI requested more history searches than this chat allows.");
      for (const call of calls) {
        const name = call.name as string;
        onStatus(toolLabels[name] ?? `calling ${name}`);
        const args = JSON.parse(call.arguments as string || "{}") as Record<string, unknown>;
        const result = await (executors[name]?.(args) ?? Promise.resolve(null));
        input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
    }
  } else {
    const input: Array<{ role: string; content: unknown }> = [...messages];
    for (let round = 0; round <= 3; round++) {
      onStatus("thinking");
      const result = await postJson("https://api.anthropic.com/v1/messages", apiKey, provider, {
        model, system: systemInstruction, messages: input, max_tokens: 4096,
        ...(round < 3 ? { tools: tools.map(({ name, description, schema }) => ({ name, description, input_schema: schema })) } : {}),
      }) as { stop_reason?: string; content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> };
      if (result.stop_reason === "max_tokens") throw new Error("Anthropic's response reached the output limit. Try a narrower question.");
      const blocks = result.content ?? [];
      finalText = blocks.filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
      const calls = blocks.filter((block) => block.type === "tool_use");
      if (!calls.length) break;
      if (round === 3) throw new Error("Anthropic requested more history searches than this chat allows.");
      input.push({ role: "assistant", content: blocks });
      const responses = [];
      for (const call of calls) {
        const name = call.name ?? "";
        onStatus(toolLabels[name] ?? `calling ${name}`);
        const result = await (executors[name]?.(call.input ?? {}) ?? Promise.resolve(null));
        responses.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) });
      }
      input.push({ role: "user", content: responses });
    }
  }

  if (!finalText.trim()) throw new Error("The model returned an empty response.");
  onText(finalText);
  onStatus(null);
  return [...messages, { role: "assistant", content: finalText }];
}
