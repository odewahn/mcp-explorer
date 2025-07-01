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

  useEffect(() => {
    const saved = localStorage.getItem("systemPrompt");
    if (saved) {
      setSystemPromptState(saved);
    }
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