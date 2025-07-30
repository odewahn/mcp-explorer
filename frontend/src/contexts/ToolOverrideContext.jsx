import React, { createContext, useContext, useState, useEffect } from "react";

// Nested map: serverName -> ({ toolName -> description })
const ToolOverrideContext = createContext({
  overrides: {},
  setOverride: () => {},
});

/**
 * Provider that stores tool description overrides in localStorage.
 */
export function ToolOverrideProvider({ children }) {
  const [overrides, setOverridesState] = useState({});

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("toolOverrides");
    if (saved) {
      try {
        setOverridesState(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Seed overrides from server-side config (explorer-config.yaml)
  useEffect(() => {
    fetch("http://localhost:8000/config")
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
        setOverridesState((prev) => {
          const merged = { ...initial };
          Object.entries(prev).forEach(([srv, tools]) => {
            merged[srv] = { ...merged[srv], ...tools };
          });
          localStorage.setItem("toolOverrides", JSON.stringify(merged));
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  // Update function: set override for a specific server/tool
  function setOverride(server, toolName, description) {
    setOverridesState((prev) => {
      const next = { ...prev };
      if (!next[server]) next[server] = {};
      next[server][toolName] = description;
      localStorage.setItem("toolOverrides", JSON.stringify(next));
      return next;
    });
  }

  return (
    <ToolOverrideContext.Provider value={{ overrides, setOverride }}>
      {children}
    </ToolOverrideContext.Provider>
  );
}

/** Hook to access tool overrides context */
export function useToolOverrides() {
  return useContext(ToolOverrideContext);
}
