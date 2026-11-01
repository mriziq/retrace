import { useState, useEffect, lazy, Suspense } from "react";
import { Settings } from "./components/Settings";
import { Onboarding } from "./components/Onboarding";
import type { ChatSettings } from "../shared/chatProviders";

const ChatApp = lazy(() => import("./ChatApp"));

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [ready, setReady] = useState(false);
  const [chatSettings, setChatSettings] = useState<ChatSettings>({ provider: "gemini", model: "gemini-3-flash-preview", openaiApiKey: "", anthropicApiKey: "" });

  useEffect(() => {
    chrome.storage.local.get(["geminiApiKey", "theme", "onboardingDone", "chatSettings"], (result) => {
      setApiKey(result.geminiApiKey ?? null);
      setOnboardingDone(!!result.onboardingDone);
      if (result.chatSettings) setChatSettings(result.chatSettings);
      const saved = result.theme === "light" ? "light" : "dark";
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
      setReady(true);
    });
  }, []);

  function applyTheme(t: "dark" | "light") {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    chrome.storage.local.set({ theme: t });
  }

  if (!ready) return null;

  if (!onboardingDone && !apiKey) {
    return (
      <div className="h-screen" style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <Onboarding onComplete={(key) => { setApiKey(key); setOnboardingDone(true); }} />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="h-screen" style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <Settings onSave={setApiKey} indexedCount={0} />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <ChatApp
        apiKey={apiKey}
        chatSettings={chatSettings}
        onChangeChatSettings={(settings) => {
          chrome.storage.local.set({ chatSettings: settings });
          setChatSettings(settings);
        }}
        theme={theme}
        onThemeChange={applyTheme}
        onSignOut={() => {
          chrome.storage.local.remove(["geminiApiKey", "chatSettings"]);
          setApiKey(null);
          setChatSettings({ provider: "gemini", model: "gemini-3-flash-preview", openaiApiKey: "", anthropicApiKey: "" });
          setOnboardingDone(true);
        }}
        onChangeKey={(key) => {
          chrome.storage.local.set({ geminiApiKey: key });
          setApiKey(key);
        }}
      />
    </Suspense>
  );
}
