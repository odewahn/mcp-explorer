import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";

const defaultPrompt =
  "You are Claude, an AI assistant. Be helpful, harmless, and honest.";
const defaultInitial = "";

const SystemPromptContext = createContext({
  systemPrompt: defaultPrompt,
  initialMessage: defaultInitial,
  setSystemPrompt: () => {},
  setInitialMessage: () => {},
  isPromptDirty: false,
  isInitialDirty: false,
  markPromptClean: () => {},
  markInitialClean: () => {},
});

/**
 * Provider component to wrap the app and manage system prompt state.
 * Loads initial prompt from server-side config on mount.
 * Tracks dirty flag when user edits the prompt.
 */
export function SystemPromptProvider({ children }) {
  const [systemPrompt, setSystemPromptState] = useState(defaultPrompt);
  const [initialMessage, setInitialMessageState] = useState(defaultInitial);
  const [isPromptDirty, setIsPromptDirty] = useState(false);
  const [isInitialDirty, setIsInitialDirty] = useState(false);

  // Load system prompt from server-side config (if provided)
  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((cfg) => {
        if (cfg.prompt) {
          setSystemPromptState(cfg.prompt);
        }
        if (cfg.initial_message) {
          setInitialMessageState(cfg.initial_message);
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
  const setInitialMessage = (msg) => {
    setInitialMessageState(msg);
    setIsInitialDirty(true);
  };

  const markPromptClean = () => setIsPromptDirty(false);
  const markInitialClean = () => setIsInitialDirty(false);

  return (
    <SystemPromptContext.Provider
      value={{
        systemPrompt,
        initialMessage,
        setSystemPrompt,
        setInitialMessage,
        isPromptDirty,
        isInitialDirty,
        markPromptClean,
        markInitialClean,
      }}
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
