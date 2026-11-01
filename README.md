# Retrace

Search your browsing history in plain English. Retrace indexes the pages you visit and lets you search them semantically — so you can find that article you half-remember, or rediscover a resource you bookmarked months ago, without needing the exact URL or title.

---

## How it works

1. As you browse, the extension quietly indexes page content in the background.
2. When you want to find something, open the extension and ask in natural language.
3. It searches your local index using embeddings and returns the most relevant pages you've visited.

The index stays in your browser. There is no Retrace server or account. Indexing and search use Gemini directly; chat uses the AI provider you select.

---

## Installation

### Chrome Web Store

The store listing is being prepared. For now, use the manual installation steps below. Maintainer instructions: [Chrome Web Store publishing](docs/chrome-web-store.md).

### Load unpacked (manual install)

1. Download or clone this repository.
2. Run `npm install && npm run build` to produce the `dist/` folder, or download a pre-built release.
3. Open Chrome and go to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the `dist/` folder.

---

## Setup

Retrace requires a Gemini API key for embeddings and semantic search. Chat can use Gemini, OpenAI, or Anthropic.

**Getting an API key:**

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with your Google account.
2. Click **Create API key** and copy it.
3. Paste the key into the extension's settings panel on first launch.

In **Config → Chat model**, select a provider, enter a model ID, and save that provider's API key if needed. Keys are stored in local extension storage and sent only to their respective API providers.

---

## Privacy

- **No Retrace backend.** The history index is stored in IndexedDB and keys in Chrome's local extension storage. Chat history stays in memory for the current session.
- **No tracking.** The extension does not collect analytics, usage data, or any personally identifiable information.
- **You control your data.** You can clear your index at any time from the extension's settings.
- **Direct API calls only.** Indexing sends page text and selected media to Google Gemini. Search queries go to Gemini for embeddings. Chat requests, including relevant history results, go to your chosen provider.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

---

## FAQ

**Why does the extension need access to my browsing history?**

Reading page content as you browse is how the extension builds its local index. Without this, there would be nothing to search. The index is stored on your device; when you use AI features, relevant content is sent directly to Google's Gemini API with your key.

**Why do I need to provide my own API key?**

There is no backend to proxy requests. Gemini handles indexing and semantic search with your key. Chat requests go directly to Gemini, OpenAI, or Anthropic using your selected model and key; provider usage may be billed by that provider.

**How do I delete my data?**

Open the extension, go to **Config**, and use the **Clear all indexed data** option. This wipes all stored page content and embeddings from your device.

**Does this work on all pages?**

The extension indexes most standard web pages. It skips pages where content access is restricted by Chrome (such as `chrome://` URLs and the Chrome Web Store).

---

## License

MIT — see [LICENSE](LICENSE).
