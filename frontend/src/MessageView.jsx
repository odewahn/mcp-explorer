import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  Collapse,
  Button,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeIcon from "@mui/icons-material/Code";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

function MessageView({ data }) {
  const containerRef = useRef(null);
  const isFirstRender = useRef(true);
  const prevDataLength = useRef(0);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showToolCalls, setShowToolCalls] = useState(false);
  const [expandedTools, setExpandedTools] = useState({});

  // Scroll to bottom when data changes (only if new data is added)
  useEffect(() => {
    // Log data for debugging
    console.log("MessageView received data:", data);
    
    // Skip first render to avoid initial animation
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (containerRef.current) {
        // Immediately position at bottom without animation
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
      prevDataLength.current = data?.conversation_history?.length || 0;
      return;
    }

    // Only scroll if data has been added
    const currentLength = data?.conversation_history?.length || 0;
    if (currentLength > prevDataLength.current && containerRef.current) {
      // Set scroll position immediately without animation
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }

    prevDataLength.current = currentLength;
  }, [data]);

  // Function to copy message content to clipboard
  const copyToClipboard = (content, index) => {
    // If content is an array, stringify it
    const textToCopy = typeof content === "string" 
      ? content 
      : JSON.stringify(content, null, 2);
      
    navigator.clipboard.writeText(textToCopy).then(
      () => {
        // Show copied indicator
        setCopiedMessageId(index);
        // Hide after 2 seconds
        setTimeout(() => setCopiedMessageId(null), 2000);
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  // Toggle expanded state for a specific tool
  const toggleToolExpand = (index) => {
    setExpandedTools(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Function to determine message style based on role
  const getMessageStyle = (role) => {
    switch (role) {
      case "user":
        return {
          backgroundColor: "#ECEFF1", // Light blue
          color: "#263238", // Dark text
          alignSelf: "flex-end",
          marginLeft: "20%",
          borderRadius: "4px",
          padding: "10px 14px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        };
      case "assistant":
        return {
          backgroundColor: "#FFFFFF", // White
          color: "#333333", // Dark text
          alignSelf: "flex-start",
          marginRight: "20%",
          borderRadius: "4px",
          padding: "10px 14px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          border: "1px solid #e0e0e0",
        };
      case "system":
        return {
          backgroundColor: "#f5f5f5", // Light grey
          color: "#666666", // Medium grey text
          alignSelf: "center",
          fontStyle: "italic",
          width: "90%",
          borderRadius: "4px",
          padding: "8px 12px",
          border: "1px solid #e0e0e0",
        };
      default:
        return {
          backgroundColor: "#f5f5f5",
        };
    }
  };

  // Render tool use content
  const renderToolUse = (item, messageIndex) => {
    const isExpanded = expandedTools[messageIndex] || false;
    
    // Safety check for required properties
    if (!item || !item.name) {
      return (
        <Box sx={{ mt: 1, mb: 1, color: 'error.main' }}>
          Invalid tool call data
        </Box>
      );
    }
    
    // Safely get input or use empty object if missing
    const toolInput = item.input || {};
    
    return (
      <Box sx={{ mt: 1, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Chip 
            icon={<CodeIcon />} 
            label={`Tool: ${item.name}`} 
            color="primary" 
            variant="outlined" 
            size="small"
            sx={{ mr: 1 }}
          />
          <IconButton 
            size="small" 
            onClick={() => toggleToolExpand(messageIndex)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        <Collapse in={isExpanded}>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 1.5, 
              backgroundColor: '#f8f9fa',
              maxHeight: '200px',
              overflow: 'auto'
            }}
          >
            <Box sx={{ fontWeight: 'bold', fontSize: '0.75rem', mb: 0.5 }}>
              Tool Parameters:
            </Box>
            <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto' }}>
              {JSON.stringify(toolInput, null, 2)}
            </pre>
          </Paper>
        </Collapse>
      </Box>
    );
  };

  // Render tool result content
  const renderToolResult = (item, messageIndex) => {
    const isExpanded = expandedTools[messageIndex] || false;
    
    // Safety check for required properties
    if (!item) {
      return (
        <Box sx={{ mt: 1, mb: 1, color: 'error.main' }}>
          Invalid tool result data
        </Box>
      );
    }
    
    // Safely determine if there's an error
    const isError = Boolean(item.is_error);
    
    // Safely get content or use placeholder if missing
    const resultContent = item.content || "[No content available]";
    
    return (
      <Box sx={{ mt: 1, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Chip 
            icon={isError ? <ErrorIcon /> : <CheckCircleIcon />} 
            label={isError ? "Tool Error" : "Tool Result"} 
            color={isError ? "error" : "success"} 
            variant="outlined" 
            size="small"
            sx={{ mr: 1 }}
          />
          <IconButton 
            size="small" 
            onClick={() => toggleToolExpand(messageIndex)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        <Collapse in={isExpanded}>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 1.5, 
              backgroundColor: isError ? '#fff8f8' : '#f8fff8',
              maxHeight: '200px',
              overflow: 'auto'
            }}
          >
            <Box sx={{ fontWeight: 'bold', fontSize: '0.75rem', mb: 0.5 }}>
              {isError ? "Error:" : "Result:"}
            </Box>
            <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto' }}>
              {typeof resultContent === 'string' 
                ? resultContent 
                : JSON.stringify(resultContent, null, 2)}
            </pre>
          </Paper>
        </Collapse>
      </Box>
    );
  };

  // Render message content based on type
  const renderMessageContent = (message, index) => {
    // If content is a string, render as text
    if (typeof message.content === "string") {
      return (
        <Typography
          variant="body1"
          component="div"
          sx={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </Typography>
      );
    }
    
    // If content is an array (tool calls or results)
    if (Array.isArray(message.content)) {
      return (
        <Box>
          {message.content.map((item, itemIndex) => {
            // Only render if showToolCalls is true
            if (!showToolCalls) return null;
            
            if (item.type === "tool_use") {
              return renderToolUse(item, `${index}-${itemIndex}`);
            }
            if (item.type === "tool_result") {
              return renderToolResult(item, `${index}-${itemIndex}`);
            }
            return null;
          })}
        </Box>
      );
    }
    
    // Handle case where content is an object but not an array
    if (typeof message.content === "object") {
      return (
        <Typography variant="body2" color="text.secondary">
          [Complex content - cannot display directly]
        </Typography>
      );
    }
    
    // Fallback for unknown content type
    return (
      <Typography variant="body2" color="text.secondary">
        [Unsupported content format]
      </Typography>
    );
  };

  // Check if a message should be displayed
  const shouldDisplayMessage = (message) => {
    // Always show text messages
    if (typeof message.content === "string") {
      return true;
    }
    
    // For tool messages, only show if showToolCalls is true
    if (Array.isArray(message.content)) {
      return showToolCalls;
    }
    
    // For other object types, always show but content will be handled in renderMessageContent
    if (typeof message.content === "object") {
      return true;
    }
    
    return true;
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

  const messages = getMessagesArray();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Box
        sx={{
          p: 1,
          borderBottom: "1px solid #e0e0e0",
          backgroundColor: "#f5f5f5",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button
          size="small"
          variant={showToolCalls ? "contained" : "outlined"}
          onClick={() => setShowToolCalls(!showToolCalls)}
          startIcon={<CodeIcon />}
          sx={{ fontSize: "0.75rem" }}
        >
          {showToolCalls ? "Hide Tool Calls" : "Show Tool Calls"}
        </Button>
      </Box>
      
      <Box
        ref={containerRef}
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          padding: "16px",
          backgroundColor: "#f5f5f5",
          border: "1px solid #e0e0e0",
          borderTop: "none",
          borderRadius: "0 0 4px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {messages.length > 0 ? (
          messages.map((message, index) => (
            shouldDisplayMessage(message) && (
              <Paper
                key={index}
                elevation={1}
                sx={{
                  padding: 2,
                  ...getMessageStyle(message.role),
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    {message.role.toUpperCase()}
                  </Typography>
                  <Tooltip
                    title={
                      copiedMessageId === index ? "Copied!" : "Copy to clipboard"
                    }
                  >
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(message.content, index)}
                      color={copiedMessageId === index ? "success" : "default"}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Divider sx={{ mb: 1 }} />
                {renderMessageContent(message, index)}
              </Paper>
            )
          ))
        ) : (
          <Box sx={{ textAlign: 'center', color: '#666', p: 4 }}>
            No messages to display. Start a conversation!
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default MessageView;
