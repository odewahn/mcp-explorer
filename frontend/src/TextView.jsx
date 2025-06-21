import React, { useEffect, useRef, useState } from "react";
import { Button, Box, Snackbar, Switch, FormControlLabel } from "@mui/material";
import { ContentCopy, Code } from "@mui/icons-material";
// You'll need to install: npm install react-markdown
import ReactMarkdown from "react-markdown";

function TextView({ data }) {
  const containerRef = useRef(null);
  const [text, setText] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [includeToolCalls, setIncludeToolCalls] = useState(false);

  // Scroll to bottom whenever data changes
  useEffect(() => {
    if (containerRef.current) {
      const timer = setTimeout(() => {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data, text]);

  // Also scroll when component mounts
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // Format message content based on its type
  const formatMessageContent = (content) => {
    // If content is a string, return it directly
    if (typeof content === "string") {
      return content;
    }
    
    // If content is an array (tool calls or results)
    if (Array.isArray(content)) {
      const toolUses = content.filter(item => item.type === "tool_use");
      const toolResults = content.filter(item => item.type === "tool_result");
      
      if (toolUses.length > 0) {
        const tool = toolUses[0];
        return includeToolCalls 
          ? `🔧 **Using tool: ${tool.name}**\n\`\`\`json\n${JSON.stringify(tool.input, null, 2)}\n\`\`\``
          : `🔧 _Using tool: ${tool.name}_`;
      }
      
      if (toolResults.length > 0) {
        const result = toolResults[0];
        // Always show tool results, but with different formatting based on includeToolCalls
        if (result.is_error) {
          return includeToolCalls
            ? `❌ **Tool Error**\n\`\`\`\n${result.content}\n\`\`\``
            : `❌ **Tool Error**: ${result.content}`;
        } else {
          return includeToolCalls
            ? `✅ **Tool Result**\n\`\`\`\n${result.content}\n\`\`\``
            : `✅ **Tool Result**: ${result.content}`;
        }
      }
    }
    
    return "[Unknown content format]";
  };

  // Determine which messages array to use (support both old and new API formats)
  const getMessagesArray = () => {
    if (data?.conversation_history && Array.isArray(data.conversation_history)) {
      return data.conversation_history;
    } else if (data?.messages && Array.isArray(data.messages)) {
      // Backward compatibility with old format
      return data.messages;
    }
    return [];
  };

  // When the data changes or includeToolCalls changes, update the text
  useEffect(() => {
    console.log("TextView received data:", data);
    
    const messages = getMessagesArray();
    if (!messages.length) {
      setText("No messages to display. Start a conversation!");
      return;
    }
    
    let out = "";
    // Iterate through the messages and add each one to the text
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      // Always include all messages, but format differently based on includeToolCalls
      const formattedContent = formatMessageContent(message.content);
      out += `**${message.role.toUpperCase()}**:  ${formattedContent}\n\n`;
    }
    setText(out);
  }, [data, includeToolCalls]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleCloseSnackbar = () => {
    setCopySuccess(false);
  };

  const toggleToolCalls = () => {
    setIncludeToolCalls(!includeToolCalls);
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        position: "relative",
      }}
    >
      {/* Controls */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          backgroundColor: "#f5f5f5",
          borderBottom: "1px solid #e0e0e0",
          padding: "8px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={includeToolCalls}
              onChange={toggleToolCalls}
              size="small"
            />
          }
          label="Include Tool Calls"
          sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<ContentCopy />}
          onClick={handleCopyText}
          sx={{ fontSize: "0.75rem" }}
        >
          Copy All
        </Button>
      </Box>

      {/* Markdown Content */}
      <Box
        ref={containerRef}
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          padding: "16px",
          scrollBehavior: "auto",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          "& pre": {
            backgroundColor: "#f0f0f0",
            padding: "12px",
            borderRadius: "4px",
            overflow: "auto",
          },
          "& code": {
            backgroundColor: "#f0f0f0",
            padding: "2px 4px",
            borderRadius: "2px",
            fontSize: "0.9em",
          },
          "& blockquote": {
            borderLeft: "4px solid #ddd",
            margin: "0 0 16px 0",
            paddingLeft: "16px",
            color: "#666",
          },
        }}
      >
        <ReactMarkdown>{text}</ReactMarkdown>
      </Box>

      {/* Success Snackbar */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        message="Text copied to clipboard!"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

export default TextView;
