import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from "@mui/material";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/mode-json";
import { API_BASE_URL } from "./apiConfig";

/**
 * Dialog displaying /tools JSON in a read-only Ace editor, with copy support.
 */
export default function ToolsJsonDialog({ open, onClose }) {
  const [toolsJson, setToolsJson] = useState("[]");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`${API_BASE_URL}/tools`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch tools: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const text = JSON.stringify(data.tools ?? data, null, 2);
        setToolsJson(text);
      })
      .catch((e) => setToolsJson(`Error: ${e.message}`));
    setCopied(false);
  }, [open]);

  const handleCopy = () => {
    navigator.clipboard.writeText(toolsJson).then(() => setCopied(true));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Available Tools (JSON)</DialogTitle>
      <DialogContent>
        <Box sx={{ height: "60vh", overflow: "hidden" }}>
          <AceEditor
            mode="json"
            theme="github"
            value={toolsJson}
            name="tools-json-editor"
            width="100%"
            height="100%"
            readOnly
            setOptions={{ useWorker: false }}
            editorProps={{ $blockScrolling: true }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCopy}>{copied ? "Copied!" : "Copy to Clipboard"}</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}