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
import SaveIcon from "@mui/icons-material/Save";
import App from "./App";
import Tools from "./Tools";
import SystemPrompt from "./SystemPrompt";
import ConfigExportDialog from "./ConfigExportDialog.jsx";
import { useSystemPrompt } from "./contexts/SystemPromptContext";
import { useToolOverrides } from "./contexts/ToolOverrideContext";

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

  const [exportOpen, setExportOpen] = useState(false);
  // Prompt user if there are unsaved configuration changes
  const { isPromptDirty, isInitialDirty } = useSystemPrompt();
  const { isOverridesDirty } = useToolOverrides();
  const hasUnsavedChanges = isPromptDirty || isInitialDirty || isOverridesDirty;
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);
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
              MCP Explorer
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
              <Tooltip title="Export current config as YAML">
                <Button
                  color="inherit"
                  startIcon={<SaveIcon />}
                  sx={{ textTransform: "none", fontWeight: 500 }}
                  onClick={() => setExportOpen(true)}
                >
                  Export Config
                </Button>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>
        <Container
          maxWidth={false}
          disableGutters
          sx={{
            mt: 2,
            pb: 2,
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            height: "calc(100% - 64px)",
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
      <ConfigExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </BrowserRouter>
  );
}

export default AppWrapper;
