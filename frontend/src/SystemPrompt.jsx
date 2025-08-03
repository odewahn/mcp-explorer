import React from "react";
import { Typography, Box, Paper, Container } from "@mui/material";
import AceEditor from "react-ace";
import { useSystemPrompt } from "./contexts/SystemPromptContext";

// Import ace modes and themes
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

function SystemPrompt() {
  const { systemPrompt, setSystemPrompt } = useSystemPrompt();

  const handleChange = (newValue) => {
    setSystemPrompt(newValue);
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
          height="calc(90vh - 200px)" // 90% of viewport height minus space for header/margins
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
            border: '1px solid #e0e0e0',
            flex: 1
          }}
        />
      </Paper>
    </Container>
  );
}

export default SystemPrompt;
