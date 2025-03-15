import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

function MessageView({ data }) {
  const containerRef = useRef(null);
  const isFirstRender = useRef(true);
  const prevDataLength = useRef(0);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  // Scroll to bottom when data changes (only if new data is added)
  useEffect(() => {
    // Skip first render to avoid initial animation
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (containerRef.current) {
        // Immediately position at bottom without animation
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
      prevDataLength.current = data?.messages?.length || 0;
      return;
    }

    // Only scroll if data has been added
    const currentLength = data?.messages?.length || 0;
    if (currentLength > prevDataLength.current && containerRef.current) {
      // Set scroll position immediately without animation
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }

    prevDataLength.current = currentLength;
  }, [data]);

  // Function to copy message content to clipboard
  const copyToClipboard = (content, index) => {
    navigator.clipboard.writeText(content).then(
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

  // Function to determine message style based on role
  const getMessageStyle = (role) => {
    switch (role) {
      case "user":
        return {
          backgroundColor: "#ECEFF1", // Docker blue
          color: "#263238", // White text
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

  return (
    <Box
      ref={containerRef}
      sx={{
        flexGrow: 1,
        overflowY: "auto",
        padding: "16px",
        backgroundColor: "#f5f5f5",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {data &&
        data.messages &&
        data.messages.map((message, index) => (
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
          </Paper>
        ))}
    </Box>
  );
}

export default MessageView;
