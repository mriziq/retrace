import { useState } from "react";

interface OnboardingProps {
  onComplete: (apiKey: string) => void;
}

const steps = [
  {
    id: "welcome",
    label: "01 / welcome",
  },
  {
    id: "how",
    label: "02 / how it works",
  },
  {
    id: "key",
    label: "03 / your api key",
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [key, setKey] = useState("");
  const [focused, setFocused] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    chrome.storage.local.set({ geminiApiKey: trimmed, onboardingDone: true });
    onComplete(trimmed);
  }

  return (
    <div
      className="relative h-full flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ background: "var(--ink)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,146,74,0.07) 0%, transparent 65%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-10">

        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div
                style={{
                  width: i === step ? 20 : 6,
                  height: 2,
                  background: i <= step ? "var(--amber)" : "var(--ink-3)",
                  transition: "all 0.3s ease",
                  borderRadius: 1,
                }}
              />
            </div>
          ))}
          <span
            className="font-mono ml-1"
            style={{ fontSize: "0.62rem", color: "var(--muted)", letterSpacing: "0.1em" }}
          >
            {steps[step].label}
          </span>
        </div>

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div
            style={{ animation: "fadeUp 0.35s ease" }}
            className="flex flex-col gap-8"
          >
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
                  fontSize: "clamp(3rem, 8vw, 5rem)",
                  color: "var(--cream)",
                  fontStyle: "italic",
                  fontWeight: 300,
                  letterSpacing: "-0.02em",
                }}
              >
                re<span style={{ color: "var(--amber)" }}>trace.</span>
              </h1>
            </div>

            <p
              className="font-mono leading-relaxed"
              style={{ fontSize: "0.72rem", color: "var(--dim)", letterSpacing: "0.02em" }}
            >
              A private AI that knows your browsing history.<br />
              Ask it anything — in plain English.
            </p>

            <div className="flex flex-col gap-2">
              {[
                "What was that article about productivity I read last week?",
                "Find everything I've looked at about React hooks.",
                "What YouTube videos did I watch yesterday?",
              ].map((q) => (
                <div
                  key={q}
                  className="font-mono"
                  style={{
                    fontSize: "0.64rem",
                    color: "var(--muted)",
                    letterSpacing: "0.02em",
                    borderLeft: "2px solid var(--ink-3)",
                    paddingLeft: "10px",
                    fontStyle: "italic",
                  }}
                >
                  "{q}"
                </div>
              ))}
            </div>

            <NextButton onClick={() => setStep(1)} />
          </div>
        )}

        {/* ── Step 1: How it works ── */}
        {step === 1 && (
          <div
            style={{ animation: "fadeUp 0.35s ease" }}
            className="flex flex-col gap-8"
          >
            <div>
              <h2
                className="font-display"
                style={{
                  fontSize: "clamp(2rem, 5vw, 3rem)",
                  color: "var(--cream)",
                  fontStyle: "italic",
                  fontWeight: 300,
                  letterSpacing: "-0.02em",
                }}
              >
                how it<br />
                <span style={{ color: "var(--amber)" }}>works.</span>
              </h2>
            </div>

            <div className="flex flex-col gap-5">
              {[
                {
                  n: "1",
                  title: "Captures as you browse",
                  body: "The extension quietly records page titles and content from every site you visit.",
                },
                {
                  n: "2",
                  title: "Builds a local index",
                  body: "Page text and selected media go directly to Google Gemini for embeddings. The resulting index stays in your browser.",
                },
                {
                  n: "3",
                  title: "You ask, it finds",
                  body: "An AI assistant searches your personal index and answers questions about what you've read.",
                },
              ].map((item) => (
                <div key={item.n} className="flex gap-4">
                  <span
                    className="font-mono shrink-0"
                    style={{
                      fontSize: "0.62rem",
                      color: "var(--amber)",
                      letterSpacing: "0.1em",
                      marginTop: "2px",
                    }}
                  >
                    {item.n}
                  </span>
                  <div>
                    <p
                      className="font-mono"
                      style={{ fontSize: "0.7rem", color: "var(--cream)", letterSpacing: "0.02em" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="font-mono mt-1 leading-relaxed"
                      style={{ fontSize: "0.65rem", color: "var(--dim)", letterSpacing: "0.02em" }}
                    >
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="font-mono leading-relaxed"
              style={{
                fontSize: "0.65rem",
                color: "var(--muted)",
                letterSpacing: "0.03em",
                borderTop: "1px solid var(--ink-2)",
                paddingTop: "16px",
              }}
            >
              Your data never leaves your machine.<br />
              Your API key goes straight to Google — not through us.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="font-mono"
                style={{
                  fontSize: "0.68rem",
                  letterSpacing: "0.12em",
                  color: "var(--muted)",
                  background: "none",
                  border: "1px solid var(--ink-3)",
                  padding: "9px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                ← Back
              </button>
              <NextButton onClick={() => setStep(2)} />
            </div>
          </div>
        )}

        {/* ── Step 2: Enter API key ── */}
        {step === 2 && (
          <div
            style={{ animation: "fadeUp 0.35s ease" }}
            className="flex flex-col gap-8"
          >
            <div>
              <h2
                className="font-display"
                style={{
                  fontSize: "clamp(2rem, 5vw, 3rem)",
                  color: "var(--cream)",
                  fontStyle: "italic",
                  fontWeight: 300,
                  letterSpacing: "-0.02em",
                }}
              >
                one last<br />
                <span style={{ color: "var(--amber)" }}>thing.</span>
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              <p
                className="font-mono leading-relaxed"
                style={{ fontSize: "0.68rem", color: "var(--dim)", letterSpacing: "0.02em" }}
              >
                You need a Gemini API key for embeddings and search.<br />
                You can choose a different chat provider in Config.<br />
                Your browser sends page content to Gemini for indexing. The key and index stay in this browser.
              </p>

              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="font-mono"
                style={{
                  fontSize: "0.65rem",
                  color: "var(--amber)",
                  letterSpacing: "0.05em",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Get your key at aistudio.google.com/apikey ↗
              </a>
            </div>

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
                  style={{ fontSize: "0.62rem", color: "var(--muted)", letterSpacing: "0.03em" }}
                >
                  Stored locally in your browser · never transmitted to us
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="font-mono"
                  style={{
                    fontSize: "0.68rem",
                    letterSpacing: "0.12em",
                    color: "var(--muted)",
                    background: "none",
                    border: "1px solid var(--ink-3)",
                    padding: "9px 16px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={!key.trim()}
                  style={{
                    flex: 1,
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
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-mono self-start"
      style={{
        fontSize: "0.7rem",
        letterSpacing: "0.2em",
        color: "var(--ink)",
        background: "var(--amber)",
        border: "1px solid var(--amber)",
        padding: "10px 20px",
        cursor: "pointer",
        transition: "all 0.15s",
        textTransform: "uppercase",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--amber-b)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--amber)")}
    >
      Continue →
    </button>
  );
}
