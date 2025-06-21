import React, { useState, useEffect, useCallback } from "react";
import { Typography, Box, Paper } from "@mui/material";
import AceEditor from "react-ace";

// Import ace modes and themes
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

function SystemPrompt({ onSystemPromptChange }) {
  const [systemPrompt, setSystemPrompt] = useState("");

  // Save system prompt to localStorage
  const saveSystemPrompt = useCallback((prompt) => {
    localStorage.setItem('systemPrompt', prompt);
  }, []);

  // Load the initial system prompt when component mounts
  useEffect(() => {
    // Default system prompt
    const defaultPrompt =
      "You are Claude, an AI assistant. Be helpful, harmless, and honest.";
    
    // Try to load from localStorage first
    const savedPrompt = localStorage.getItem('systemPrompt');
    const promptToUse = savedPrompt || defaultPrompt;
    
    setSystemPrompt(promptToUse);

    // Notify parent component of the initial value
    if (onSystemPromptChange) {
      onSystemPromptChange(promptToUse);
    }
  }, [onSystemPromptChange]);

  const handleChange = (newValue) => {
    setSystemPrompt(newValue);
    
    // Save to localStorage
    saveSystemPrompt(newValue);

    // Notify parent component of the change
    if (onSystemPromptChange) {
      onSystemPromptChange(newValue);
    }
  };

  return (
    <Box sx={{ mb: 3, mt: 1 }}>
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 1, 
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}
      >
        <Typography 
          variant="subtitle2" 
          sx={{ 
            pl: 1, 
            pb: 0.5, 
            color: '#666666',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center'
          }}
        >
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
          style={{
            borderRadius: '4px',
            border: '1px solid #e0e0e0'
          }}
        />
      </Paper>
    </Box>
  );
}

export default SystemPrompt;
