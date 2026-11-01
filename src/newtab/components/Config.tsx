import { useState, useEffect } from "react";
import type { ActivePhase } from "./IndexingStatus";
import { clearAllHistory, estimateStorageMB } from "../../shared/db";
import type { ChatSettings, ChatProvider } from "../../shared/chatProviders";

interface ConfigProps {
  stats: { total: number; enriched: number; unenriched: number; embedded: number; pending: number };
  activePhase: ActivePhase | null;
  apiKey: string;
  chatSettings: ChatSettings;
  onChangeChatSettings: (settings: ChatSettings) => void;
  onRun: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onChangeKey: (key: string) => void;
  onSignOut: () => void;
  onClose: () => void;
}

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between py-3" style={{ borderBottom: "1px solid var(--ink-2)" }}>
      <span className="font-mono" style={{ fontSize: "0.75rem", letterSpacing: "0.08em", color: "var(--muted)" }}>
        {label}
      </span>
      <span className="font-mono" style={{ fontSize: "0.85rem", color: accent ?? "var(--cream)", fontWeight: 400 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

export function Config({ stats, activePhase, apiKey, chatSettings, onChangeChatSettings, onRun, onCancel, onRefresh, onChangeKey, onSignOut, onClose }: ConfigProps) {
  const [newKey, setNewKey] = useState("");
  const [keyFocused, setKeyFocused] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [storageMB, setStorageMB] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [chatKey, setChatKey] = useState("");

  useEffect(() => {
    estimateStorageMB().then(setStorageMB);
  }, [stats.total]);

  async function handleClear() {
    await clearAllHistory();
    setConfirmClear(false);
    onRefresh();
  }

  const isActive = activePhase !== null;
  const embeddedPct = stats.total === 0 ? 0 : Math.round((stats.embedded / stats.total) * 100);
  const enrichedPct = stats.total === 0 ? 0 : Math.round((stats.enriched / stats.total) * 100);
  const activePct = isActive && activePhase.total > 0
    ? Math.round((activePhase.done / activePhase.total) * 100)
    : 0;

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (newKey.trim()) {
      chrome.storage.local.set({ geminiApiKey: newKey.trim() });
      onChangeKey(newKey.trim());
      setNewKey("");
      setShowKeyInput(false);
    }
  }

  const maskedKey = apiKey ? `${apiKey.slice(0, 7)}···${apiKey.slice(-4)}` : "—";

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--ink)", overflowY: "auto" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ borderBottom: "1px solid var(--ink-2)", background: "var(--ink-1)", height: 56 }}
      >
        <span
          className="font-mono"
          style={{ fontSize: "0.72rem", letterSpacing: "0.18em", color: "var(--muted)", textTransform: "uppercase" }}
        >
          Configuration
        </span>
        <button
          onClick={onClose}
          className="font-mono"
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.12em",
            color: "var(--amber)",
            background: "none",
            border: "none",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          ← Back
        </button>
      </div>

      <div className="flex flex-col gap-8 px-4 py-8">

        {/* Archive Stats */}
        <section>
          <p
            className="font-mono mb-1"
            style={{ fontSize: "0.65rem", letterSpacing: "0.22em", color: "var(--dim)", textTransform: "uppercase" }}
          >
            Archive
          </p>
          <div>
            <StatRow label="Total pages" value={stats.total} />
            <StatRow label="Enriched" value={stats.enriched} accent={stats.unenriched === 0 ? "var(--amber)" : "var(--cream)"} />
            <StatRow label="Embedded" value={stats.embedded} accent={stats.pending === 0 ? "var(--amber)" : "var(--cream)"} />
            <StatRow label="Needs enrichment" value={stats.unenriched} accent={stats.unenriched > 0 ? "var(--cream-2)" : "var(--dim)"} />
            <StatRow label="Needs embedding" value={stats.pending} accent={stats.pending > 0 ? "var(--cream-2)" : "var(--dim)"} />
          </div>
        </section>

        {/* Progress bars */}
        <section>
          <p
            className="font-mono mb-4"
            style={{ fontSize: "0.65rem", letterSpacing: "0.22em", color: "var(--dim)", textTransform: "uppercase" }}
          >
            Progress
          </p>
          <div className="flex flex-col gap-4">
            {/* Enrichment */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-mono" style={{ fontSize: "0.72rem", color: isActive && activePhase?.name === "enriching" ? "var(--amber)" : "var(--muted)" }}>
                  {isActive && activePhase?.name === "enriching" ? `Fetching pages… ${activePhase.done}/${activePhase.total}` : "Content enrichment"}
                </span>
                <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--cream-2)" }}>
                  {isActive && activePhase?.name === "enriching" ? `${activePct}%` : `${enrichedPct}%`}
                </span>
              </div>
              <div style={{ height: 3, background: "var(--ink-3)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${isActive && activePhase?.name === "enriching" ? activePct : enrichedPct}%`,
                  background: "var(--amber-b)",
                  transition: "width 0.4s ease",
                  borderRadius: 2,
                }} />
              </div>
            </div>

            {/* Embedding */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-mono" style={{ fontSize: "0.72rem", color: isActive && activePhase?.name === "embedding" ? "var(--amber)" : "var(--muted)" }}>
                  {isActive && activePhase?.name === "embedding" ? `Embedding… ${activePhase.done}/${activePhase.total}` : "Vector embedding"}
                </span>
                <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--cream-2)" }}>
                  {isActive && activePhase?.name === "embedding" ? `${activePct}%` : `${embeddedPct}%`}
                </span>
              </div>
              <div style={{ height: 3, background: "var(--ink-3)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${isActive && activePhase?.name === "embedding" ? activePct : embeddedPct}%`,
                  background: "var(--amber)",
                  transition: "width 0.4s ease",
                  borderRadius: 2,
                }} />
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="flex flex-wrap gap-3">
          {isActive ? (
            <button
              onClick={onCancel}
              className="font-mono"
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.12em",
                color: "#B05050",
                background: "none",
                border: "1px solid #5A2828",
                borderRadius: 4,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Stop
            </button>
          ) : (
            <>
              <button
                onClick={onRun}
                disabled={stats.unenriched === 0 && stats.pending === 0}
                className="font-mono"
                style={{
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  color: (stats.unenriched > 0 || stats.pending > 0) ? "var(--ink)" : "var(--dim)",
                  background: (stats.unenriched > 0 || stats.pending > 0) ? "var(--amber)" : "var(--ink-2)",
                  border: "none",
                  borderRadius: 4,
                  padding: "8px 16px",
                  cursor: (stats.unenriched > 0 || stats.pending > 0) ? "pointer" : "default",
                }}
              >
                {stats.unenriched > 0 ? "Enrich & embed" : stats.pending > 0 ? "Embed pending" : "Up to date ✓"}
              </button>
              <button
                onClick={onRefresh}
                className="font-mono"
                style={{
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  color: "var(--cream-2)",
                  background: "none",
                  border: "1px solid var(--ink-3)",
                  borderRadius: 4,
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                ↻ Check for new pages
              </button>
            </>
          )}
        </section>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--ink-2)" }} />

        {/* Storage */}
        <section>
          <p
            className="font-mono mb-4"
            style={{ fontSize: "0.65rem", letterSpacing: "0.22em", color: "var(--dim)", textTransform: "uppercase" }}
          >
            Local Storage
          </p>
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              IndexedDB footprint
            </span>
            <span className="font-mono" style={{ fontSize: "0.85rem", color: "var(--cream-2)" }}>
              {storageMB !== null ? `~${storageMB} MB` : "—"}
            </span>
          </div>

          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="font-mono"
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.1em",
                color: "#B05050",
                background: "none",
                border: "1px solid #3A1A1A",
                borderRadius: 4,
                padding: "7px 14px",
                cursor: "pointer",
              }}
            >
              Clear all indexed data
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--cream-2)" }}>
                Delete all {stats.total.toLocaleString()} pages?
              </span>
              <button
                onClick={handleClear}
                className="font-mono"
                style={{
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  color: "var(--ink)",
                  background: "#8B3A3A",
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="font-mono"
                style={{
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--ink-2)" }} />

        <section className="flex flex-col gap-3">
          <p className="font-mono" style={{ fontSize: "0.65rem", letterSpacing: "0.22em", color: "var(--dim)", textTransform: "uppercase" }}>
            Chat model
          </p>
          <label className="font-mono" style={{ fontSize: "0.68rem", color: "var(--muted)" }} htmlFor="chat-provider">Provider</label>
          <select
            id="chat-provider"
            value={chatSettings.provider}
            onChange={(e) => {
              const provider = e.target.value as ChatProvider;
              setChatKey("");
              onChangeChatSettings({ ...chatSettings, provider, model: provider === "gemini" ? "gemini-3-flash-preview" : provider === "openai" ? "gpt-4.1-mini" : "claude-sonnet-4-5" });
            }}
            style={{ background: "var(--ink-1)", color: "var(--cream)", border: "1px solid var(--ink-3)", borderRadius: 4, padding: "8px" }}
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <label className="font-mono" style={{ fontSize: "0.68rem", color: "var(--muted)" }} htmlFor="chat-model">Model ID</label>
          <input
            id="chat-model"
            value={chatSettings.model}
            onChange={(e) => onChangeChatSettings({ ...chatSettings, model: e.target.value })}
            placeholder={chatSettings.provider === "openai" ? "e.g. gpt-4.1-mini" : chatSettings.provider === "anthropic" ? "e.g. claude-sonnet-4-5" : "e.g. gemini-3-flash-preview"}
            className="font-mono"
            style={{ background: "var(--ink-1)", color: "var(--cream)", border: "1px solid var(--ink-3)", borderRadius: 4, padding: "8px", fontSize: "0.75rem" }}
          />
          {chatSettings.provider !== "gemini" && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const key = chatKey.trim();
              if (!key) return;
              onChangeChatSettings({ ...chatSettings, [chatSettings.provider === "openai" ? "openaiApiKey" : "anthropicApiKey"]: key });
              setChatKey("");
            }} className="flex flex-col gap-2">
              <label className="font-mono" style={{ fontSize: "0.68rem", color: "var(--muted)" }} htmlFor="chat-key">
                {chatSettings.provider === "openai" ? "OpenAI" : "Anthropic"} API key · {(chatSettings.provider === "openai" ? chatSettings.openaiApiKey : chatSettings.anthropicApiKey) ? "saved locally" : "required"}
              </label>
              <div className="flex gap-2">
                <input id="chat-key" type="password" value={chatKey} onChange={(e) => setChatKey(e.target.value)} placeholder="Paste API key" autoComplete="off" className="font-mono" style={{ flex: 1, minWidth: 0, background: "var(--ink-1)", color: "var(--cream)", border: "1px solid var(--ink-3)", borderRadius: 4, padding: "8px", fontSize: "0.75rem" }} />
                <button type="submit" disabled={!chatKey.trim()} className="font-mono" style={{ color: "var(--ink)", background: "var(--amber)", border: 0, borderRadius: 4, padding: "8px 12px", opacity: chatKey.trim() ? 1 : 0.5 }}>Save</button>
              </div>
            </form>
          )}
          <p className="font-mono" style={{ fontSize: "0.63rem", color: "var(--dim)", lineHeight: 1.5 }}>
            Gemini still powers indexing and semantic search. Chat requests go directly to the selected provider.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--ink-2)" }} />

        {/* API Key */}
        <section>
          <p
            className="font-mono mb-4"
            style={{ fontSize: "0.65rem", letterSpacing: "0.22em", color: "var(--dim)", textTransform: "uppercase" }}
          >
            Gemini API Key
          </p>
          <div className="flex items-center justify-between">
            <span className="font-mono" style={{ fontSize: "0.82rem", color: "var(--cream-2)", letterSpacing: "0.06em" }}>
              {maskedKey}
            </span>
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="font-mono"
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                color: "var(--amber)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              {showKeyInput ? "Cancel" : "Change"}
            </button>
          </div>

          {showKeyInput && (
            <form onSubmit={handleSaveKey} className="flex gap-3 mt-4">
              <div
                style={{
                  flex: 1,
                  borderBottom: `1px solid ${keyFocused ? "var(--amber)" : "var(--ink-3)"}`,
                  transition: "border-color 0.2s",
                  paddingBottom: 6,
                }}
              >
                <input
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  onFocus={() => setKeyFocused(true)}
                  onBlur={() => setKeyFocused(false)}
                  placeholder="AIza···"
                  autoFocus
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--cream)",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.8rem",
                    width: "100%",
                    letterSpacing: "0.05em",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!newKey.trim()}
                className="font-mono"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.1em",
                  color: newKey.trim() ? "var(--ink)" : "var(--dim)",
                  background: newKey.trim() ? "var(--amber)" : "var(--ink-2)",
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 14px",
                  cursor: newKey.trim() ? "pointer" : "default",
                }}
              >
                Save
              </button>
            </form>
          )}
          <p
            className="font-mono mt-3"
            style={{ fontSize: "0.65rem", color: "var(--dim)", letterSpacing: "0.04em" }}
          >
            Stored locally · only sent to Google
          </p>
          <button
            onClick={onSignOut}
            className="font-mono mt-4"
            style={{
              fontSize: "0.68rem",
              letterSpacing: "0.1em",
              color: "#8B3A3A",
              background: "none",
              border: "1px solid #3A1A1A",
              borderRadius: 4,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            Remove keys &amp; sign out
          </button>
        </section>
      </div>
    </div>
  );
}
