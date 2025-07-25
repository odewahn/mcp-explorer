import React, { createContext, useContext, useState, useEffect } from "react";

const defaultPrompt =
  "You are Claude, an AI assistant. Be helpful, harmless, and honest.";

const SystemPromptContext = createContext({
  systemPrompt: defaultPrompt,
  setSystemPrompt: () => {},
});

/**
 * Provider component to wrap the app and manage system prompt state.
 * Loads from localStorage on mount, persists on update.
 */
export function SystemPromptProvider({ children }) {
  const [systemPrompt, setSystemPromptState] = useState(defaultPrompt);

  // Load system prompt: try server-side config first, then fallback to localStorage
  useEffect(() => {
    console.debug("SystemPromptContext: fetching /config...");
    fetch("http://0.0.0.0:8000/config")
      .then((r) => {
        console.debug("SystemPromptContext: /config status", r.status);
        return r.ok ? r.json() : Promise.reject(r);
      })
      .then((cfg) => {
        console.debug("SystemPromptContext: config payload", cfg);
        if (cfg.prompt) {
          setSystemPromptState(cfg.prompt);
          localStorage.setItem("systemPrompt", cfg.prompt);
        }
      })
      .catch((err) => {
        console.debug(
          "SystemPromptContext: no server config, falling back to localStorage",
          err
        );
        const saved = localStorage.getItem("systemPrompt");
        if (saved) setSystemPromptState(saved);
      });
  }, []);

  const setSystemPrompt = (prompt) => {
    localStorage.setItem("systemPrompt", prompt);
    setSystemPromptState(prompt);
  };

  return (
    <SystemPromptContext.Provider value={{ systemPrompt, setSystemPrompt }}>
      {children}
    </SystemPromptContext.Provider>
  );
}

/**
 * Hook to access systemPrompt context.
 */
export function useSystemPrompt() {
  return useContext(SystemPromptContext);
}
