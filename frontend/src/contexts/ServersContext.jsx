import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../apiConfig";

const ServersContext = createContext({
  servers: [],
  tools: [],
  loading: true,
});

/**
 * Provider that loads MCP servers and tools from the backend.
 */
export function ServersProvider({ children }) {
  const [servers, setServers] = useState([]);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [sres, tres] = await Promise.all([
        fetch(`${API_BASE_URL}/tool-servers`),
        fetch(`${API_BASE_URL}/tools`),
      ]);
      if (sres.ok && tres.ok) {
        const srvJson = await sres.json();
        const tJson = await tres.json();
        setServers(srvJson.servers || []);
        setTools(tJson.tools || []);
      }
    } catch {
      // ignore errors; leave as empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <ServersContext.Provider value={{ servers, tools, loading, refresh }}>
      {children}
    </ServersContext.Provider>
  );
}

/**
 * Hook to access MCP servers/tools context.
 */
/**
 * Hook to access MCP servers/tools context, including a refresh function.
 */
export function useServers() {
  return useContext(ServersContext);
}