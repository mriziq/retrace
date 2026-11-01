import { getAllHistoryItems, saveHistoryItem, getUnembeddedItems, getHistoryItems } from "./db";
import { buildBinaryIndex, binaryPrefilter } from "./binaryIndex";
import type { HistoryItem } from "./types";

// ── Spec limits (Gemini Embedding 2) ─────────────────────────────────────────
const OUTPUT_DIMENSIONS = 3072;
const TOKEN_BUDGET = 8000;          // 8,192 minus small safety buffer
const MAX_AUDIO_BYTES = 3_000_000;  // covers 80s at up to 320kbps
const MAX_AUDIO_TOKENS = 2560;      // 80s × 32 tokens/s
const MAX_IMAGE_BYTES = 500_000;
const MAX_IMAGES = 6;
const TOKENS_PER_IMAGE = 300;
const CHARS_PER_TOKEN = 4;
const MIN_TEXT_TOKENS = 500;
const MAX_CHUNKS = 3;
const ALLOWED_AUDIO_MIME = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"]);
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg"]);

// Stores 1 byte per dimension instead of 4. Cosine similarity is scale-invariant
// so direction is fully preserved.
function quantize(vector: number[]): Int8Array {
  let maxAbsValue = 0;
  for (const value of vector) {
    const absValue = Math.abs(value);
    if (absValue > maxAbsValue) maxAbsValue = absValue;
  }
  const scale = maxAbsValue > 0 ? 127 / maxAbsValue : 1;
  const quantized = new Int8Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    quantized[i] = Math.max(-128, Math.min(127, Math.round(vector[i] * scale)));
  }
  return quantized;
}

// Query stays float32; stored vector is int8. Cosine similarity is scale-invariant
// so the 127× quantization factor cancels out.
function cosineSimilarity(query: number[], stored: Int8Array): number {
  let dotProduct = 0;
  let queryNorm = 0;
  let storedNorm = 0;
  for (let i = 0; i < query.length; i++) {
    dotProduct += query[i] * stored[i];
    queryNorm += query[i] * query[i];
    storedNorm += stored[i] * stored[i];
  }
  return dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(storedNorm));
}

interface FetchedMedia { data: string; mimeType: string; byteSize: number; }

const FETCH_TIMEOUT_MS = 10_000;
const BASE64_CHUNK_SIZE = 8192;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

async function fetchAsBase64(url: string, maxBytes: number, allowedMime?: Set<string>): Promise<FetchedMedia | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), credentials: "omit" });
    if (!response.ok) return null;

    const mimeType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (allowedMime && !allowedMime.has(mimeType)) return null;

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > 0 && declaredLength > maxBytes) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) return null;

    return { data: bufferToBase64(buffer), mimeType, byteSize: buffer.byteLength };
  } catch { return null; }
}

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const GEMINI_EMBEDDING_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent";

async function callGeminiEmbedding(parts: object[], apiKey: string, taskType: TaskType): Promise<number[]> {
  const response = await fetch(GEMINI_EMBEDDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      model: "models/gemini-embedding-2-preview",
      content: { parts },
      taskType,
      outputDimensionality: OUTPUT_DIMENSIONS,
    }),
  });
  if (!response.ok) throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return data.embedding.values as number[];
}

const AUDIO_BYTES_PER_TOKEN = 512; // ≈ 1 token per 512 bytes at 128 kbps

function buildEmbedText(item: HistoryItem): string {
  if (item.embedContent) return `${item.title} ${item.embedContent}`;
  if (item.excerpt) return `${item.title} ${item.excerpt}`;
  return item.title ? `${item.title} ${item.url}` : item.url;
}

async function pickFirstAudioPart(item: HistoryItem): Promise<{ part: object; tokens: number } | null> {
  for (const url of (item.mediaUrls?.audio ?? [])) {
    const audio = await fetchAsBase64(url, MAX_AUDIO_BYTES, ALLOWED_AUDIO_MIME);
    if (!audio) continue;
    const tokens = Math.ceil(audio.byteSize / AUDIO_BYTES_PER_TOKEN);
    if (tokens > MAX_AUDIO_TOKENS) continue;
    return {
      part: { inlineData: { mimeType: audio.mimeType, data: audio.data } },
      tokens,
    };
  }
  return null;
}

async function pickImageParts(item: HistoryItem, tokensRemaining: number): Promise<object[]> {
  const availableSlots = Math.min(MAX_IMAGES, Math.floor((tokensRemaining - MIN_TEXT_TOKENS) / TOKENS_PER_IMAGE));
  if (availableSlots <= 0) return [];

  const imageUrls = (item.mediaUrls?.images ?? []).slice(0, availableSlots);
  const fetched = await Promise.all(
    imageUrls.map((url) => fetchAsBase64(url, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME))
  );

  const parts: object[] = [];
  let tokensUsed = 0;
  for (const image of fetched) {
    if (!image) continue;
    if (tokensUsed + TOKENS_PER_IMAGE > tokensRemaining - MIN_TEXT_TOKENS) break;
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    tokensUsed += TOKENS_PER_IMAGE;
  }
  return parts;
}

async function buildEmbeddingChunks(item: HistoryItem): Promise<Array<{ parts: object[] }>> {
  const primaryParts: object[] = [];
  let tokensUsed = 0;

  const audio = await pickFirstAudioPart(item);
  if (audio) {
    primaryParts.push(audio.part);
    tokensUsed += audio.tokens;
  }

  const imageParts = await pickImageParts(item, TOKEN_BUDGET - tokensUsed);
  primaryParts.push(...imageParts);
  tokensUsed += imageParts.length * TOKENS_PER_IMAGE;

  const fullText = buildEmbedText(item);
  const primaryTextChars = (TOKEN_BUDGET - tokensUsed) * CHARS_PER_TOKEN;
  primaryParts.unshift({ text: fullText.slice(0, primaryTextChars) });

  const chunks: Array<{ parts: object[] }> = [{ parts: primaryParts }];

  const overflow = fullText.slice(primaryTextChars);
  const chunkChars = TOKEN_BUDGET * CHARS_PER_TOKEN;
  for (let offset = 0; offset < overflow.length && chunks.length < MAX_CHUNKS; offset += chunkChars) {
    const slice = overflow.slice(offset, offset + chunkChars).trim();
    if (slice) chunks.push({ parts: [{ text: `${item.title}: ${slice}` }] });
  }

  return chunks;
}

export async function embedText(text: string, apiKey: string): Promise<number[]> {
  return callGeminiEmbedding([{ text }], apiKey, "RETRIEVAL_QUERY");
}

function bestScore(queryEmbedding: number[], item: HistoryItem): number {
  const primaryScore = cosineSimilarity(queryEmbedding, item.embedding!);
  const chunkScores = (item.chunkEmbeddings ?? []).map((chunk) => cosineSimilarity(queryEmbedding, chunk));
  return Math.max(primaryScore, ...chunkScores);
}

function withinTimeRange(item: HistoryItem, startTime?: number, endTime?: number): boolean {
  if (startTime !== undefined && item.visitedAt < startTime) return false;
  if (endTime !== undefined && item.visitedAt > endTime) return false;
  return true;
}

export interface SearchResult extends HistoryItem { score: number; }

export async function searchHistory(
  query: string,
  apiKey: string,
  topK = 10,
  startTime?: number,
  endTime?: number
): Promise<SearchResult[]> {
  const queryEmbedding = await embedText(query, apiKey);
  const candidateUrls = await binaryPrefilter(queryEmbedding, startTime, endTime);

  let items: HistoryItem[];
  if (candidateUrls.length >= topK) {
    items = await getHistoryItems(candidateUrls);
  } else {
    // Index not built yet or corpus smaller than topK — full scan fallback.
    const all = await getAllHistoryItems();
    items = all.filter((item) => item.embedding !== null && withinTimeRange(item, startTime, endTime));
  }

  const embeddedItems = items.filter((item) => item.embedding !== null);
  const scored = embeddedItems.map((item) => ({ ...item, score: bestScore(queryEmbedding, item) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

async function embedChunkWithTextFallback(
  chunk: { parts: object[] },
  apiKey: string
): Promise<Int8Array | null> {
  try {
    const floats = await callGeminiEmbedding(chunk.parts, apiKey, "RETRIEVAL_DOCUMENT");
    return quantize(floats);
  } catch {
    // Multimodal request failed — retry with text-only if present.
    const textPart = chunk.parts.find((part): part is { text: string } => "text" in part);
    if (!textPart) return null;
    try {
      const floats = await callGeminiEmbedding([textPart], apiKey, "RETRIEVAL_DOCUMENT");
      return quantize(floats);
    } catch {
      return null;
    }
  }
}

async function embedSingleItem(item: HistoryItem, apiKey: string): Promise<Int8Array[]> {
  const chunks = await buildEmbeddingChunks(item);
  const embeddings: Int8Array[] = [];
  for (const chunk of chunks) {
    const embedding = await embedChunkWithTextFallback(chunk, apiKey);
    if (embedding) embeddings.push(embedding);
  }
  return embeddings;
}

export async function embedPendingItems(
  apiKey: string,
  onProgress?: (done: number, total: number) => void,
  cancelRef?: { current: boolean }
): Promise<void> {
  const pending = await getUnembeddedItems();
  const total = pending.length;
  if (total === 0) return;

  for (let i = 0; i < pending.length; i++) {
    if (cancelRef?.current) break;
    const item = pending[i];
    try {
      const embeddings = await embedSingleItem(item, apiKey);
      if (embeddings.length > 0) {
        const [primary, ...rest] = embeddings;
        await saveHistoryItem({ ...item, embedding: primary, chunkEmbeddings: rest, embedContent: null });
      }
    } catch {
      // Skip this item; it will be retried on the next pipeline run.
    }

    onProgress?.(i + 1, total);
  }

  await buildBinaryIndex();
}
