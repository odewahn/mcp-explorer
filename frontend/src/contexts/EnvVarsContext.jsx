import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";

// Nested map: serverName -> ({ varName -> value })
const EnvVarsContext = createContext({
  envVars: {},
  setEnvVars: () => {},
  renameServerEnvVars: () => {},
  isEnvVarsDirty: false,
  markEnvVarsClean: () => {},
});

/**
 * Provider for managing environment variable name/value pairs per server.
 * Seeds initial values from server-side config and tracks dirty state.
 */
export function EnvVarsProvider({ children }) {
  const [envVars, setEnvVarsState] = useState({});
  const [isEnvVarsDirty, setIsEnvVarsDirty] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((cfg) => {
        const initial = {};
        (cfg.mcp || []).forEach((srv) => {
          if (Array.isArray(srv.environment_variables)) {
            initial[srv.name] = srv.environment_variables.reduce(
              (acc, e) =>
                typeof e.key === "string" && typeof e.val === "string"
                  ? { ...acc, [e.key]: e.val }
                  : acc,
              {}
            );
          }
        });
        setEnvVarsState(initial);
        setIsEnvVarsDirty(false);
      })
      .catch(() => {});
  }, []);

  /** Set the full envVars map for a server */
  const setEnvVars = (server, varsMap) => {
    setEnvVarsState((prev) => ({ ...prev, [server]: varsMap }));
    setIsEnvVarsDirty(true);
  };

  /** Rename a server key map when server is renamed */
  const renameServerEnvVars = (oldName, newName) => {
    setEnvVarsState((prev) => {
      const next = { ...prev };
      if (prev[oldName] !== undefined) {
        next[newName] = prev[oldName];
        delete next[oldName];
      }
      return next;
    });
    setIsEnvVarsDirty(true);
  };

  const markEnvVarsClean = () => setIsEnvVarsDirty(false);

  return (
    <EnvVarsContext.Provider
      value={{ envVars, setEnvVars, renameServerEnvVars, isEnvVarsDirty, markEnvVarsClean }}
    >
      {children}
    </EnvVarsContext.Provider>
  );
}

/** Hook to access EnvVars context */
export function useEnvVars() {
  return useContext(EnvVarsContext);
}