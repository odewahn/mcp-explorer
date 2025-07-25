import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  Tooltip,
} from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import BuildIcon from "@mui/icons-material/Build";
import SettingsIcon from "@mui/icons-material/Settings";
import App from "./App";
import Tools from "./Tools";
import SystemPrompt from "./SystemPrompt";

// Helper component to handle route changes
function RouteObserver({ setActivePage }) {
  const location = useLocation();

  useEffect(() => {
    // Set active page based on current path
    const path = location.pathname;
    if (path === "/" || path === "/static/") {
      setActivePage("chat");
    } else if (path === "/tools") {
      setActivePage("tools");
    } else if (path === "/system-prompt") {
      setActivePage("system-prompt");
    }
  }, [location, setActivePage]);

  // Run once on component mount to set the initial active page
  useEffect(() => {
    const path = location.pathname;
    if (path === "/" || path === "/static/") {
      setActivePage("chat");
    } else if (path === "/tools") {
      setActivePage("tools");
    } else if (path === "/system-prompt") {
      setActivePage("system-prompt");
    }
  }, [setActivePage]);

  return null;
}

function AppWrapper() {
  // Initialize activePage based on the current URL path
  const [activePage, setActivePage] = useState(() => {
    // Get the initial path from window.location
    const path = window.location.pathname;
    // Handle paths
    if (path === "/tools") {
      return "tools";
    } else if (path === "/system-prompt") {
      return "system-prompt";
    } else if (path === "/static/" || path === "/") {
      return "chat";
    } else {
      // Default to chat for any other path
      return "chat";
    }
  });

  // Initial setup: load config and auto-connect MCP servers
  const [setupState, setSetupState] = useState({ status: "loading" });
  const [config, setConfig] = useState(null);

  // Fetch YAML config via API
  useEffect(() => {
    console.debug("AppWrapper: fetching /config endpoint");
    fetch("http://0.0.0.0:8000/config")
      .then((r) => {
        console.debug("AppWrapper: /config status", r.status);
        if (r.status === 404) throw new Error("no-config");
        return r.json();
      })
      .then((cfg) => {
        console.debug("AppWrapper: config payload", cfg);
        setConfig(cfg);
        setSetupState({ status: "connecting" });
      })
      .catch((err) => {
        console.debug("AppWrapper: no config or error", err);
        if (err.message === "no-config") {
          setSetupState({ status: "done" });
        } else {
          console.error("AppWrapper: error fetching config", err);
          setSetupState({ status: "error", error: err });
        }
      });
  }, []);

  // Auto-connect to each MCP server from config: POST once, then poll GET /tools
  useEffect(() => {
    if (setupState.status !== "connecting" || !config?.mcp?.length) {
      return;
    }
    console.debug(
      "AppWrapper: beginning MCP server connect phase:",
      config.mcp
    );

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    async function connectServers() {
      const results = [];
      for (const { name, cmd } of config.mcp) {
        let ok = false;
        let error = "";

        // 1) POST once to register the server
        try {
          const addRes = await fetch("http://localhost:8000/add-tool-server", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, url: cmd, server_type: "stdio" }),
          });
          if (!addRes.ok) {
            error = await addRes.text();
            console.error(`Failed to add server ${name}:`, error);
          }
        } catch (e) {
          error = String(e);
          console.error(`Exception adding server ${name}:`, e);
        }

        // 2) If registration succeeded, poll GET /tools until tool appears
        if (!error) {
          const maxPolls = 10;
          for (let attempt = 1; attempt <= maxPolls; attempt++) {
            console.debug(
              `Polling /tools for ${name}, attempt ${attempt}/${maxPolls}`
            );
            try {
              const toolsRes = await fetch("http://localhost:8000/tools");
              if (toolsRes.ok) {
                const { tools } = await toolsRes.json();
                if (tools.find((t) => t.server === name)) {
                  ok = true;
                  break;
                }
              } else {
                console.warn(
                  `Unexpected status polling /tools: ${toolsRes.status}`
                );
              }
            } catch (e) {
              console.error("Error polling /tools:", e);
            }
            await delay(1000);
          }
        }

        results.push({ name, ok, error });
      }
      console.debug("AppWrapper: MCP connect results:", results);
      setSetupState({ status: "done", results });
    }

    connectServers();
  }, [setupState.status, config]);

  if (setupState.status === "loading") {
    return <Box sx={{ p: 2 }}>Loading configuration…</Box>;
  }
  if (setupState.status === "connecting") {
    return <Box sx={{ p: 2 }}>Connecting to tool servers…</Box>;
  }
  if (setupState.status === "error") {
    return (
      <Box sx={{ p: 2, color: "error.main" }}>
        Error during setup: {String(setupState.error)}
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <RouteObserver setActivePage={setActivePage} />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <AppBar
          position="static"
          sx={{ backgroundColor: "#1976d2", boxShadow: "none" }}
        >
          <Toolbar>
            <Typography
              variant="h6"
              component="div"
              sx={{ flexGrow: 1, fontWeight: 500 }}
            >
              Claude Client
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Button
                color="inherit"
                component={Link}
                to="/"
                startIcon={<ChatIcon />}
                sx={{
                  mr: 2,
                  backgroundColor:
                    activePage === "chat"
                      ? "rgba(255, 255, 255, 0.15)"
                      : "transparent",
                  borderRadius: "4px",
                  textTransform: "none",
                  fontWeight: 500,
                  padding: "8px 16px",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.25)",
                  },
                }}
                onClick={() => setActivePage("chat")}
              >
                Chat
              </Button>
              <Tooltip title="Edit System Prompt">
                <Button
                  color="inherit"
                  component={Link}
                  to="/system-prompt"
                  startIcon={<SettingsIcon />}
                  sx={{
                    backgroundColor:
                      activePage === "system-prompt"
                        ? "rgba(255, 255, 255, 0.15)"
                        : "transparent",
                    borderRadius: "4px",
                    textTransform: "none",
                    fontWeight: 500,
                    padding: "8px 16px",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                    },
                  }}
                  onClick={() => setActivePage("system-prompt")}
                >
                  System Prompt
                </Button>
              </Tooltip>
              <Button
                color="inherit"
                component={Link}
                to="/tools"
                startIcon={<BuildIcon />}
                sx={{
                  mr: 2,
                  backgroundColor:
                    activePage === "tools"
                      ? "rgba(255, 255, 255, 0.15)"
                      : "transparent",
                  borderRadius: "4px",
                  textTransform: "none",
                  fontWeight: 500,
                  padding: "8px 16px",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.25)",
                  },
                }}
                onClick={() => setActivePage("tools")}
              >
                Tools
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
        <Container
          sx={{
            mt: 2,
            pb: 2,
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden", // Prevent container from scrolling
            height: "calc(100% - 64px)", // Subtract AppBar height
          }}
        >
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/static/" element={<App />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/system-prompt" element={<SystemPrompt />} />
          </Routes>
        </Container>
      </Box>
    </BrowserRouter>
  );
}

export default AppWrapper;
