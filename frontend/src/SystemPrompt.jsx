import React, { useState, useEffect, useCallback } from "react";
import { Typography, Box, Paper, Container, Snackbar, Alert } from "@mui/material";
import AceEditor from "react-ace";

// Import ace modes and themes
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

function SystemPrompt({ onSystemPromptChange = () => {} }) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Save system prompt to localStorage
  const saveSystemPrompt = useCallback((prompt) => {
    localStorage.setItem('systemPrompt', prompt);
    setSaveSuccess(true);
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

  const handleCloseSnackbar = () => {
    setSaveSuccess(false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3, height: '100%' }}>
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 3, 
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          height: 'auto'
        }}
      >
        <Typography 
          variant="h5" 
          sx={{ 
            mb: 2, 
            color: '#333333',
            fontWeight: 500
          }}
        >
          System Prompt
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            mb: 3, 
            color: '#666666'
          }}
        >
          The system prompt provides initial instructions to the AI. It helps set the context and behavior for the conversation.
        </Typography>
        <AceEditor
          mode="text"
          theme="github"
          name="system-prompt-editor"
          onChange={handleChange}
          value={systemPrompt}
          width="100%"
          height="300px"
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
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          System prompt saved successfully!
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default SystemPrompt;
