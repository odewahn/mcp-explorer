import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";

// Nested map: serverName -> ({ toolName -> description })
const ToolOverrideContext = createContext({
  overrides: {},
  setOverride: () => {},
  isOverridesDirty: false,
  markOverridesClean: () => {},
  renameServer: () => {},
});

/**
 * Provider that holds tool description overrides loaded from server-side config.
 * Tracks dirty flag when user edits any override.
 */
export function ToolOverrideProvider({ children }) {
  const [overrides, setOverridesState] = useState({});
  const [isOverridesDirty, setIsOverridesDirty] = useState(false);

  // Seed overrides from server-side config (explorer-config.yaml)
  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((cfg) => {
        const initial = {};
        (cfg.mcp || []).forEach((srv) => {
          const serverName = srv.name;
          (srv.tools || []).forEach((t) => {
            const desc = t.description;
            if (typeof desc === 'string' && desc.trim()) {
              if (!initial[serverName]) initial[serverName] = {};
              initial[serverName][t.name] = desc;
            }
          });
        });
        setOverridesState(initial);
        setIsOverridesDirty(false);
      })
      .catch(() => {
        // No server config; start with empty overrides
      });
  }, []);

  // Update function: set override for a specific server/tool
  function setOverride(server, toolName, description) {
    setOverridesState((prev) => ({
      ...prev,
      [server]: { ...(prev[server] || {}), [toolName]: description },
    }));
    setIsOverridesDirty(true);
  }

  // Rename overrides mapping when a server is renamed
  function renameServer(oldName, newName) {
    setOverridesState((prev) => {
      const next = { ...prev };
      if (prev[oldName] !== undefined) {
        next[newName] = prev[oldName];
        delete next[oldName];
      }
      return next;
    });
    setIsOverridesDirty(true);
  }

  const markOverridesClean = () => {
    setIsOverridesDirty(false);
  };

  return (
    <ToolOverrideContext.Provider
      value={{ overrides, setOverride, isOverridesDirty, markOverridesClean, renameServer }}
    >
      {children}
    </ToolOverrideContext.Provider>
  );
}

/** Hook to access tool overrides context */
export function useToolOverrides() {
  return useContext(ToolOverrideContext);
}
