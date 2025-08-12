import React from "react";
import { Typography, Box, Paper, Container } from "@mui/material";
import AceEditor from "react-ace";
import { useSystemPrompt } from "./contexts/SystemPromptContext";
import { API_BASE_URL } from "./apiConfig";

// Import ace modes and themes
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

function SystemPrompt() {
  const { systemPrompt, setSystemPrompt, initialMessage, setInitialMessage } = useSystemPrompt();

  const handleChangePrompt = (newValue) => {
    setSystemPrompt(newValue);
  };
  const handleChangeInitial = async (newValue) => {
    setInitialMessage(newValue);
    try {
      await fetch(`${API_BASE_URL}/config/initial-message`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial_message: newValue }),
      });
    } catch (e) {
      console.error("Failed to update initial message on server:", e);
    }
  };


  return (
    <Container maxWidth="lg" sx={{ py: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 3, 
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          height: '90vh'
        }}
      >
        <Typography variant="h6" gutterBottom>
          Initial Message
        </Typography>
        <AceEditor
          mode="text"
          theme="github"
          name="initial-message-editor"
          onChange={handleChangeInitial}
          value={initialMessage}
          width="100%"
          height="100px"
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={true}
          placeholder="Enter initial user message (first prompt)..."
          setOptions={{ tabSize: 2, wrap: true }}
          style={{ borderRadius: '4px', border: '1px solid #e0e0e0', mb: 2 }}
        />

        <Typography variant="h6" gutterBottom>
          System Prompt
        </Typography>
        <Typography variant="body2" gutterBottom>
          The system prompt provides initial instructions to the AI.
        </Typography>
        <AceEditor
          mode="text"
          theme="github"
          name="system-prompt-editor"
          onChange={handleChangePrompt}
          value={systemPrompt}
          width="100%"
          flex={1}
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={true}
          placeholder="Enter system instructions for the AI..."
          setOptions={{ tabSize: 2, wrap: true }}
          style={{ borderRadius: '4px', border: '1px solid #e0e0e0', flex: 1 }}
        />
      </Paper>
    </Container>
  );
}

export default SystemPrompt;
