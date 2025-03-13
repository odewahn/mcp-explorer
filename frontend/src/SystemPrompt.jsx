import React, { useState, useEffect } from "react";
import { Typography, Box, Paper } from "@mui/material";
import AceEditor from "react-ace";

// Import ace modes and themes
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

function SystemPrompt({ onSystemPromptChange }) {
  const [systemPrompt, setSystemPrompt] = useState("");

  // Load the initial system prompt when component mounts
  useEffect(() => {
    // Default system prompt
    const defaultPrompt =
      "You are Claude, an AI assistant. Be helpful, harmless, and honest.";
    setSystemPrompt(defaultPrompt);

    // Notify parent component of the initial value
    if (onSystemPromptChange) {
      onSystemPromptChange(defaultPrompt);
    }
  }, []);

  const handleChange = (newValue) => {
    setSystemPrompt(newValue);

    // Notify parent component of the change
    if (onSystemPromptChange) {
      onSystemPromptChange(newValue);
    }
  };

  return (
    <Box sx={{ mb: 1, mt: 1 }}>
      <Paper variant="outlined" sx={{ p: 0.5 }}>
        <Typography variant="caption" sx={{ pl: 1, color: 'text.secondary' }}>
          System Prompt
        </Typography>
        <AceEditor
          mode="text"
          theme="github"
          name="system-prompt-editor"
          onChange={handleChange}
          value={systemPrompt}
          width="100%"
          height="100px"
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={true}
          placeholder="Enter system instructions for the AI..."
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: false,
            showLineNumbers: true,
            tabSize: 2,
            wrap: true,
          }}
        />
      </Paper>
    </Box>
  );
}

export default SystemPrompt;
