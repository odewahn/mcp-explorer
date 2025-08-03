import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";

// Nested map: serverName -> ({ toolName -> description })
const ToolOverrideContext = createContext({
  overrides: {},
  setOverride: () => {},
  isOverridesDirty: false,
  markOverridesClean: () => {},
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
          if (!initial[serverName]) initial[serverName] = {};
          (srv.tools || []).forEach((t) => {
            initial[serverName][t.name] = t.description;
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

  const markOverridesClean = () => {
    setIsOverridesDirty(false);
  };

  return (
    <ToolOverrideContext.Provider
      value={{ overrides, setOverride, isOverridesDirty, markOverridesClean }}
    >
      {children}
    </ToolOverrideContext.Provider>
  );
}

/** Hook to access tool overrides context */
export function useToolOverrides() {
  return useContext(ToolOverrideContext);
}
