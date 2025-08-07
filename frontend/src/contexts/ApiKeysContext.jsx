import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";

// Nested map: serverName -> ({ keyName -> value })
const ApiKeysContext = createContext({
  apiKeys: {},
  setApiKeys: () => {},
  renameServerApiKeys: () => {},
  isApiKeysDirty: false,
  markApiKeysClean: () => {},
});

/**
 * Provider for managing API key name/value pairs per server.
 * Seeds initial placeholders from server-side config and tracks dirty state.
 */
export function ApiKeysProvider({ children }) {
  const [apiKeys, setApiKeysState] = useState({});
  const [isApiKeysDirty, setIsApiKeysDirty] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((cfg) => {
        const initial = {};
        (cfg.mcp || []).forEach((srv) => {
          if (Array.isArray(srv.api_keys)) {
            initial[srv.name] = Object.fromEntries(
              srv.api_keys.map((k) => [k, ""])
            );
          }
        });
        setApiKeysState(initial);
        setIsApiKeysDirty(false);
      })
      .catch(() => {});
  }, []);

  /** Set the full apiKeys map for a server */
  const setApiKeys = (server, keysMap) => {
    setApiKeysState((prev) => ({ ...prev, [server]: keysMap }));
    setIsApiKeysDirty(true);
  };

  /** Rename a server key map when server is renamed */
  const renameServerApiKeys = (oldName, newName) => {
    setApiKeysState((prev) => {
      const next = { ...prev };
      if (prev[oldName] !== undefined) {
        next[newName] = prev[oldName];
        delete next[oldName];
      }
      return next;
    });
    setIsApiKeysDirty(true);
  };

  const markApiKeysClean = () => setIsApiKeysDirty(false);

  return (
    <ApiKeysContext.Provider
      value={{ apiKeys, setApiKeys, renameServerApiKeys, isApiKeysDirty, markApiKeysClean }}
    >
      {children}
    </ApiKeysContext.Provider>
  );
}

/** Hook to access API‑Keys context */
export function useApiKeys() {
  return useContext(ApiKeysContext);
}