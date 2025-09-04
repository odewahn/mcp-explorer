import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";

const defaultPrompt =
  "You are Claude, an AI assistant. Be helpful, harmless, and honest.";
const defaultInitial = "";

const SystemPromptContext = createContext({
  systemPrompt: defaultPrompt,
  initialMessage: defaultInitial,
  model: "",
  setSystemPrompt: () => {},
  setInitialMessage: () => {},
  setModel: () => {},
  isPromptDirty: false,
  isInitialDirty: false,
  markPromptClean: () => {},
  markInitialClean: () => {},
  modelList: [],
});

/**
 * Provider component to wrap the app and manage system prompt state.
 * Loads initial prompt from server-side config on mount.
 * Tracks dirty flag when user edits the prompt.
 */
export function SystemPromptProvider({ children }) {
  const [systemPrompt, setSystemPromptState] = useState(defaultPrompt);
  const [initialMessage, setInitialMessageState] = useState(defaultInitial);
  const [model, setModelState] = useState("");
  const [modelList, setModelList] = useState([]);
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
        if (cfg.model) {
          setModelState(cfg.model);
        }
        // Fetch available LLM models from backend
        fetch(`${API_BASE_URL}/models`)
          .then((r) => (r.ok ? r.json() : Promise.reject(r)))
          .then((data) => {
            if (Array.isArray(data.models)) {
              setModelList(data.models);
            }
          })
          .catch(() => {
            // ignore fetch errors
          });
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

  const setModel = (m) => {
    setModelState(m);
    fetch(`${API_BASE_URL}/config/model`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: m }),
    }).catch(() => {
      /* ignore errors */
    });
  };

  const markPromptClean = () => setIsPromptDirty(false);
  const markInitialClean = () => setIsInitialDirty(false);

  return (
    <SystemPromptContext.Provider
      value={{
        systemPrompt,
        initialMessage,
        model,
        modelList,
        setSystemPrompt,
        setInitialMessage,
        setModel,
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
