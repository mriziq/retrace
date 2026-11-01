import { saveHistoryItem, getHistoryItem } from "../shared/db";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_IMAGES = 5;
const MAX_AUDIO_FILES = 1;
const EXCERPT_MAX_CHARS = 400;
const EXCERPT_BODY_CHARS = 300;
const EMBED_CONTENT_MAX_CHARS = 30_000;
const EMBED_CONTENT_BODY_CHARS = 29_800;
const NON_CONTENT_ICON_HINTS = ["favicon", "icon", "avatar", "logo"];
const SKIP_PREFIXES = ["chrome://", "chrome-extension://", "about:", "data:", "file://"];

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// API keys live in chrome.storage.local. Content scripts never need access to them.
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

function isWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function getMainContentRoot(doc: Document): HTMLElement | null {
  return (doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body) as HTMLElement | null;
}

function getMetaContent(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const content = doc.querySelector(selector)?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return "";
}

function extractVisibleText(doc: Document, maxChars: number): string {
  const clone = getMainContentRoot(doc)?.cloneNode(true) as HTMLElement | null;
  if (!clone) return "";
  clone.querySelectorAll("script,style,nav,header,footer,aside,button,form").forEach((el) => el.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function looksLikeIconUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return NON_CONTENT_ICON_HINTS.some((hint) => lower.includes(hint));
}

function extractImageUrls(doc: Document): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const ogImage = getMetaContent(doc, ['meta[property="og:image"]', 'meta[name="twitter:image"]']);
  if (ogImage) {
    seen.add(ogImage);
    urls.push(ogImage);
  }

  getMainContentRoot(doc)?.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (!src || seen.has(src) || src.startsWith("data:")) return;
    if (looksLikeIconUrl(src)) return;
    // Without rendered dimensions, we can only keep absolute http(s) URLs.
    if (!src.startsWith("http")) return;
    seen.add(src);
    urls.push(src);
  });

  return urls.slice(0, MAX_IMAGES);
}

function extractAudioUrls(doc: Document): string[] {
  const urls: string[] = [];
  doc.querySelectorAll("audio").forEach((audioEl) => {
    const src = audioEl.getAttribute("src") || audioEl.querySelector("source")?.getAttribute("src") || "";
    if (!src || urls.includes(src)) return;
    const pathLower = src.split("?")[0].toLowerCase();
    if (pathLower.endsWith(".mp3") || pathLower.endsWith(".wav")) urls.push(src);
  });
  return urls.slice(0, MAX_AUDIO_FILES);
}

function shouldSkip(url: string): boolean {
  return SKIP_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function parsePageMetadata(doc: Document) {
  const title =
    getMetaContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    doc.title ||
    "";
  const description = getMetaContent(doc, [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]);

  const bodyShort = extractVisibleText(doc, EXCERPT_BODY_CHARS);
  const excerpt = [description, bodyShort].filter(Boolean).join(" ").slice(0, EXCERPT_MAX_CHARS);
  const embedContent = [description, extractVisibleText(doc, EMBED_CONTENT_BODY_CHARS)]
    .filter(Boolean)
    .join(" ")
    .slice(0, EMBED_CONTENT_MAX_CHARS);

  return {
    title,
    excerpt,
    embedContent,
    mediaUrls: {
      images: extractImageUrls(doc),
      audio: extractAudioUrls(doc),
    },
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "FETCH_PAGE") {
    if (!sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) || !isWebUrl(message.url)) return;
    const url = message.url;
    fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), credentials: "omit" })
      .then(async (response) => {
        if (!response.ok) return sendResponse(null);
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) return sendResponse(null);

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        sendResponse(parsePageMetadata(doc));
      })
      .catch(() => sendResponse(null));
    return true;
  }
});

chrome.history.onVisited.addListener((result) => {
  const url = result.url ?? "";
  const title = result.title ?? url;
  if (!url || shouldSkip(url)) return;

  getHistoryItem(url).then((existing) => {
    if (!existing) {
      saveHistoryItem({
        url,
        title,
        visitedAt: Date.now(),
        embedding: null,
        chunkEmbeddings: [],
        excerpt: null,
        embedContent: null,
        mediaUrls: { images: [], audio: [] },
        enriched: false,
      });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "PAGE_CONTENT") return;

  if (!sender.tab || !isWebUrl(message.payload?.url) || sender.url !== message.payload.url) return;

  const { url, title, excerpt, embedContent, mediaUrls } = message.payload as {
    url: string;
    title: string;
    excerpt: string;
    embedContent: string;
    mediaUrls: { images: string[]; audio: string[] };
  };

  getHistoryItem(url).then((existing) => {
    if (existing?.enriched) return;

    saveHistoryItem({
      url,
      title: title || existing?.title || url,
      visitedAt: existing?.visitedAt ?? Date.now(),
      embedding: existing?.embedding ?? null,
      chunkEmbeddings: existing?.chunkEmbeddings ?? [],
      excerpt,
      embedContent,
      mediaUrls: mediaUrls ?? { images: [], audio: [] },
      enriched: true,
    });
  });
});
