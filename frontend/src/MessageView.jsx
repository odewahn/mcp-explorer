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
  Switch,
  FormControlLabel,
  Menu,
  MenuItem,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import CodeIcon from "@mui/icons-material/Code";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
// For HTML conversion
import { marked } from "marked";

function MessageView({ data }) {
  const containerRef = useRef(null);
  const isFirstRender = useRef(true);
  const prevDataLength = useRef(0);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [showToolCalls, setShowToolCalls] = useState(true);
  const [expandedTools, setExpandedTools] = useState({});
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);

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

  // Function to open copy menu
  const openCopyMenu = (event, index) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedMessageIndex(index);
  };

  // Function to close copy menu
  const closeCopyMenu = () => {
    setMenuAnchorEl(null);
  };

  // Function to copy raw message content to clipboard
  const copyRawToClipboard = (content, index) => {
    // If content is an array, stringify it
    const textToCopy = typeof content === "string" 
      ? content 
      : JSON.stringify(content, null, 2);
      
    navigator.clipboard.writeText(textToCopy).then(
      () => {
        // Show copied indicator
        setCopiedMessageId(index);
        setCopyMessage("Raw text copied");
        // Hide after 2 seconds
        setTimeout(() => setCopiedMessageId(null), 2000);
        closeCopyMenu();
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  // Function to copy formatted message content for Google Docs
  const copyFormattedToClipboard = (content, index) => {
    try {
      // If content is not a string, stringify it
      const textToFormat = typeof content === "string" 
        ? content 
        : JSON.stringify(content, null, 2);
      
      // Convert to HTML
      const html = marked(textToFormat);
      
      // Create a temporary element to hold the HTML
      const tempElement = document.createElement('div');
      tempElement.innerHTML = html;
      document.body.appendChild(tempElement);
      
      // Select the content
      const range = document.createRange();
      range.selectNodeContents(tempElement);
      
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Execute copy command
      document.execCommand('copy');
      
      // Clean up
      selection.removeAllRanges();
      document.body.removeChild(tempElement);
      
      // Show copied indicator
      setCopiedMessageId(index);
      setCopyMessage("Formatted text copied for Google Docs");
      // Hide after 2 seconds
      setTimeout(() => setCopiedMessageId(null), 2000);
      closeCopyMenu();
    } catch (err) {
      console.error("Could not copy formatted text: ", err);
    }
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
            <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
    
    // Try to parse JSON if the content is a JSON string
    let formattedContent = resultContent;
    if (typeof resultContent === 'string') {
      try {
        // Check if the string is JSON
        const parsedJson = JSON.parse(resultContent);
        formattedContent = JSON.stringify(parsedJson, null, 2);
      } catch (e) {
        // Not JSON, use as is
        formattedContent = resultContent;
      }
    } else if (typeof resultContent === 'object') {
      formattedContent = JSON.stringify(resultContent, null, 2);
    }
    
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
            <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {formattedContent}
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
            // For tool calls and results, always render a summary
            // but only expand details if showToolCalls is true
            if (item.type === "tool_use") {
              if (!showToolCalls) {
                return (
                  <Box key={itemIndex} sx={{ mt: 1, mb: 1 }}>
                    <Chip 
                      icon={<CodeIcon />} 
                      label={`Tool Call: ${item.name}`}
                      color="primary" 
                      variant="outlined" 
                      size="small"
                    />
                  </Box>
                );
              }
              return renderToolUse(item, `${index}-${itemIndex}`);
            }
            
            if (item.type === "tool_result") {
              // Always show a basic summary of tool results
              const isError = Boolean(item.is_error);
              
              if (!showToolCalls) {
                // Show a simple summary with the result content
                return (
                  <Box key={itemIndex} sx={{ mt: 1, mb: 1 }}>
                    <Chip 
                      icon={isError ? <ErrorIcon /> : <CheckCircleIcon />}
                      label={isError ? "Tool Error" : "Tool Result"}
                      color={isError ? "error" : "success"}
                      variant="outlined" 
                      size="small"
                      sx={{ mb: 1 }}
                    />
                    <Box 
                      sx={{ 
                        pl: 1, 
                        borderLeft: `3px solid ${isError ? '#f44336' : '#4caf50'}`,
                        fontSize: '0.9rem',
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: '100px',
                        overflow: 'auto'
                      }}
                    >
                      <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {typeof item.content === 'string' 
                          ? item.content 
                          : JSON.stringify(item.content, null, 2)}
                      </pre>
                    </Box>
                  </Box>
                );
              }
              
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
    
    // For tool messages, check if they should be shown
    if (Array.isArray(message.content)) {
      // If not showing tool calls and all content items are tool-related, skip the message
      if (!showToolCalls) {
        const allToolRelated = message.content.every(
          item => item.type === "tool_use" || item.type === "tool_result"
        );
        if (allToolRelated) {
          return false;
        }
      }
      return true;
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
        overflow: "hidden", // Prevent outer container from scrolling
        backgroundColor: "#ffffff",
      }}
    >
      
      {/* Controls */}
      <Box
        sx={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e0e0e0",
          padding: "8px 16px",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={showToolCalls}
              onChange={() => setShowToolCalls(!showToolCalls)}
              size="small"
            />
          }
          label="Show Tool Calls"
          sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
        />
      </Box>
      
      <Box
        ref={containerRef}
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          padding: "16px",
          backgroundColor: "#ffffff",
          border: "1px solid #e0e0e0",
          borderTop: "none",
          borderRadius: "0 0 4px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minHeight: 0, // Important for proper flexbox behavior
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
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {copiedMessageId === index && (
                      <Typography variant="caption" color="success.main" sx={{ mr: 1 }}>
                        {copyMessage}
                      </Typography>
                    )}
                    <IconButton
                      size="small"
                      onClick={(event) => openCopyMenu(event, index)}
                      color={copiedMessageId === index ? "success" : "default"}
                      aria-label="Copy options"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
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

      {/* Copy Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={closeCopyMenu}
      >
        <MenuItem 
          onClick={() => selectedMessageIndex !== null && 
            copyRawToClipboard(messages[selectedMessageIndex].content, selectedMessageIndex)}
        >
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          Copy Raw Text
        </MenuItem>
        <MenuItem 
          onClick={() => selectedMessageIndex !== null && 
            copyFormattedToClipboard(messages[selectedMessageIndex].content, selectedMessageIndex)}
        >
          <FormatBoldIcon fontSize="small" sx={{ mr: 1 }} />
          Copy Formatted for Google Docs
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default MessageView;
