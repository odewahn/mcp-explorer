import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
import YAML from "js-yaml";
import { useToolOverrides } from "./contexts/ToolOverrideContext";
import { useSystemPrompt } from "./contexts/SystemPromptContext";
import { useServers } from "./contexts/ServersContext";

/**
 * Dialog to preview and download current UI configuration as YAML.
 */
export default function ConfigExportDialog({ open, onClose }) {
  const [yamlText, setYamlText] = useState("");
  const { overrides, markOverridesClean } = useToolOverrides();
  const { systemPrompt, markPromptClean } = useSystemPrompt();

  const { servers } = useServers();
  useEffect(() => {
    if (!open) return;
    console.debug("ConfigExportDialog: servers:", servers);
    console.debug("ConfigExportDialog: overrides:", overrides);
    console.debug("ConfigExportDialog: systemPrompt:", systemPrompt);

    // Build aggregate config from contexts
    const cfgObj = {
      prompt: systemPrompt,
      mcp: servers.map((srv) => ({
        name: srv.name,
        type: srv.url.startsWith("http") ? "sse" : "stdio",
        url: srv.url,
        // Do not include API keys in exported config
        api_keys: srv.api_keys || [],
        tools: Object.entries(overrides[srv.name] || {})
          .filter(([, desc]) => typeof desc === 'string' && desc.trim() !== '')
          .map(([name, description]) => ({ name, description })),
      })),
    };
    console.debug("ConfigExportDialog: merged config object:", cfgObj);
    const yaml = YAML.dump(cfgObj);
    console.debug("ConfigExportDialog: generated YAML:", yaml);
    setYamlText(yaml);
  }, [open, servers, overrides, systemPrompt]);

  const handleDownload = () => {
    const blob = new Blob([yamlText || ""], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".mcp-explorer";
    a.click();
    URL.revokeObjectURL(url);
    // Mark configs as saved (clean state)
    markPromptClean();
    markOverridesClean();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Export Configuration (YAML)</DialogTitle>
      <DialogContent>
        <TextField
          value={yamlText}
          multiline
          fullWidth
          minRows={20}
          variant="outlined"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDownload} variant="contained">
          Download YAML
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}