# Privacy Policy — Retrace

**Last updated: October 31, 2026**

---

## Overview

Retrace is a Chrome extension that lets you search and chat with your own browsing history. It is designed with privacy as a first principle: **no data is ever sent to the developer, and no backend server exists.**

---

## What Data Is Collected

**The developer collects no data whatsoever.** There is no analytics, no telemetry, no crash reporting, and no backend infrastructure operated by this extension.

---

## What Data the Extension Uses (Locally)

Your history index is stored in local IndexedDB. API keys are stored in Chrome's local extension storage. Content sent to AI providers is described below.

### Browsing History
- The extension reads the **title, URL, and visit time** of pages you visit.
- This data is stored **locally in IndexedDB** in your browser profile.
- It is never transmitted to the developer.

### Page Content
- The content script reads visible text from the page, plus selected image and audio URLs, to build a searchable index.
- The extension stores an excerpt and up to roughly 30,000 characters of page text locally for indexing and search.
- It does not intentionally read passwords, form values, or authenticated content.

### Embeddings
- Page text and selected media are sent directly from your browser to Google's Gemini API when indexing runs.
- The resulting embeddings are stored **locally in IndexedDB** alongside the indexed page data.

---

## Your API Keys

- You provide your own Google Gemini API key in the extension settings.
- The Gemini key is used for embeddings and semantic search, and for chat if you select Gemini.
- If you select OpenAI or Anthropic for chat, you provide a separate key for that provider. Your chat prompt, conversation, and history-search tool results (including relevant page titles, URLs, and excerpts) are sent directly to that provider.
- All keys are stored in **chrome.storage.local**. The developer never sees, receives, or stores them.

---

## Third-Party Services

AI requests go directly from your browser to **Google's Gemini API** (`generativelanguage.googleapis.com`) for embeddings and semantic search. Chat requests go to the selected provider: Google Gemini, **OpenAI** (`api.openai.com`), or **Anthropic** (`api.anthropic.com`). Your use of each API is governed by that provider's terms and privacy policy.

---

## Data Retention and Deletion

- The history index is stored in IndexedDB and API keys in **chrome.storage.local**.
- You can clear the history index in Config and remove saved keys with **Remove keys & sign out**. Uninstalling the extension or clearing its site data in Chrome settings also removes local extension data.
- Retrace does not retain a remote copy of your data. Data sent to AI providers is handled under their policies and terms.

---

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect any information from children.

---

## Changes to This Policy

If this policy changes, the updated version will be published in the extension's repository and on this page with a new effective date. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## Contact

If you have questions about this privacy policy, contact: **amer@mriziq.com**
