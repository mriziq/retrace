import { useState } from "react";

interface SettingsProps {
  onSave: (apiKey: string) => void;
  indexedCount: number;
}

export function Settings({ onSave, indexedCount }: SettingsProps) {
  const [key, setKey] = useState("");
  const [focused, setFocused] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (key.trim()) {
      chrome.storage.local.set({ geminiApiKey: key.trim() });
      onSave(key.trim());
    }
  }

  return (
    <div
      style={{ background: "var(--ink)" }}
      className="relative h-full flex flex-col items-center justify-center px-6 overflow-hidden"
    >
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,146,74,0.06) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-10">
        {/* Title */}
        <div>
          <p
            className="font-mono text-xs tracking-[0.3em] uppercase mb-5"
            style={{ color: "var(--amber)" }}
          >
            Personal Archive
          </p>
          <h1
            className="font-display leading-none"
            style={{
              fontSize: "clamp(3.5rem, 8vw, 5.5rem)",
              color: "var(--cream)",
              fontStyle: "italic",
              fontWeight: 300,
              letterSpacing: "-0.02em",
            }}
          >
            re<span style={{ color: "var(--amber)" }}>trace.</span>
          </h1>
          <p
            className="font-mono mt-5 leading-relaxed"
            style={{ fontSize: "0.72rem", color: "var(--dim)", letterSpacing: "0.02em" }}
          >
            Your browsing history, made searchable.<br />
            Your search index stays on your machine.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <p
              className="font-mono text-xs tracking-widest uppercase mb-3"
              style={{ color: "var(--muted)" }}
            >
              Gemini API Key
            </p>
            <div
              style={{
                borderBottom: `1px solid ${focused ? "var(--amber)" : "var(--ink-3)"}`,
                transition: "border-color 0.2s",
                paddingBottom: "8px",
              }}
            >
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
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
            <p
              className="font-mono mt-2"
              style={{ fontSize: "0.65rem", color: "var(--muted)", letterSpacing: "0.03em" }}
            >
              Stored locally · never transmitted to us
            </p>
          </div>

          <button
            type="submit"
            disabled={!key.trim()}
            style={{
              background: key.trim() ? "var(--amber)" : "transparent",
              border: `1px solid ${key.trim() ? "var(--amber)" : "var(--ink-3)"}`,
              color: key.trim() ? "var(--ink)" : "var(--muted)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.7rem",
              letterSpacing: "0.2em",
              padding: "10px 20px",
              cursor: key.trim() ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              textTransform: "uppercase",
            }}
          >
            Enter the Archive →
          </button>
        </form>

        {indexedCount > 0 && (
          <p
            className="font-mono"
            style={{ fontSize: "0.65rem", color: "var(--muted)", letterSpacing: "0.1em" }}
          >
            {indexedCount.toLocaleString()} pages on record
          </p>
        )}
      </div>
    </div>
  );
}
