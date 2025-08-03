import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import AppWrapper from "./AppWrapper.jsx";
import theme from "./theme";
import "./index.css";
import { SystemPromptProvider } from "./contexts/SystemPromptContext";
import { ToolOverrideProvider } from "./contexts/ToolOverrideContext";
import { ServersProvider } from "./contexts/ServersContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SystemPromptProvider>
        <ToolOverrideProvider>
          <ServersProvider>
            <AppWrapper />
          </ServersProvider>
        </ToolOverrideProvider>
      </SystemPromptProvider>
    </ThemeProvider>
  </StrictMode>
);
