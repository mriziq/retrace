// Raw part shape from Gemini SSE — permissive to preserve all fields (thoughtSignature, id, etc.)
type RawPart = Record<string, unknown>;

export interface GeminiMessage {
  role: "user" | "model";
  parts: RawPart[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type ToolExecutors = Record<string, (args: Record<string, unknown>) => Promise<unknown>>;

interface ParsedFunctionCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function streamOneTurn(
  apiKey: string,
  model: string,
  contents: GeminiMessage[],
  systemInstruction: string,
  functionDeclarations: FunctionDeclaration[],
  onChunk: (text: string) => void
): Promise<{ modelParts: RawPart[]; functionCalls: ParsedFunctionCall[] }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      ...(functionDeclarations.length && { tools: [{ functionDeclarations }] }),
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Gemini ${res.status}: ${msg}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const modelParts: RawPart[] = [];
  const functionCalls: ParsedFunctionCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (!json) continue;

      let event: { candidates?: Array<{ content?: { parts?: RawPart[] } }> };
      try { event = JSON.parse(json); } catch { continue; }

      for (const part of event.candidates?.[0]?.content?.parts ?? []) {
        // Always push the raw part verbatim — preserves thoughtSignature, id, thought, etc.
        modelParts.push(part);

        const fc = part.functionCall as { name?: string; args?: Record<string, unknown>; id?: string } | undefined;
        if (fc?.name) {
          functionCalls.push({ name: fc.name, args: fc.args ?? {}, id: fc.id });
        } else if (typeof part.text === "string" && !part.thought) {
          onChunk(part.text as string);
        }
      }
    }
  }

  return { modelParts, functionCalls };
}

export async function runChat(
  apiKey: string,
  model: string,
  userText: string,
  history: GeminiMessage[],
  systemInstruction: string,
  functionDeclarations: FunctionDeclaration[],
  executors: ToolExecutors,
  onChunk: (text: string) => void,
  maxRounds = 3,
  onStatus?: (status: string | null) => void
): Promise<GeminiMessage[]> {
  const contents: GeminiMessage[] = [
    ...history,
    { role: "user", parts: [{ text: userText }] },
  ];

  const toolLabels: Record<string, string> = {
    searchHistory: "searching your history",
    getRecentHistory: "checking recent pages",
  };

  for (let round = 0; round <= maxRounds; round++) {
    onStatus?.("thinking");
    const { modelParts, functionCalls } = await streamOneTurn(
      apiKey, model, contents, systemInstruction, functionDeclarations, onChunk
    );

    contents.push({ role: "model", parts: modelParts });

    if (!functionCalls.length) break;

    const responses = await Promise.all(
      functionCalls.map(async ({ name, args, id }) => {
        onStatus?.(toolLabels[name] ?? `calling ${name}`);
        const result = await (executors[name]?.(args) ?? Promise.resolve(null));
        return {
          functionResponse: {
            ...(id && { id }),
            name,
            response: { output: result },
          },
        } as RawPart;
      })
    );

    contents.push({ role: "user", parts: responses });
  }

  onStatus?.(null);

  return contents;
}
