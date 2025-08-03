import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";

const defaultPrompt =
  "You are Claude, an AI assistant. Be helpful, harmless, and honest.";

const SystemPromptContext = createContext({
  systemPrompt: defaultPrompt,
  setSystemPrompt: () => {},
  isPromptDirty: false,
  markPromptClean: () => {},
});

/**
 * Provider component to wrap the app and manage system prompt state.
 * Loads initial prompt from server-side config on mount.
 * Tracks dirty flag when user edits the prompt.
 */
export function SystemPromptProvider({ children }) {
  const [systemPrompt, setSystemPromptState] = useState(defaultPrompt);
  const [isPromptDirty, setIsPromptDirty] = useState(false);

  // Load system prompt from server-side config (if provided)
  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((cfg) => {
        if (cfg.prompt) {
          setSystemPromptState(cfg.prompt);
        }
      })
      .catch(() => {
        // No server config; use default prompt
      });
  }, []);

  const setSystemPrompt = (prompt) => {
    setSystemPromptState(prompt);
    setIsPromptDirty(true);
  };

  const markPromptClean = () => {
    setIsPromptDirty(false);
  };

  return (
    <SystemPromptContext.Provider
      value={{ systemPrompt, setSystemPrompt, isPromptDirty, markPromptClean }}
    >
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
