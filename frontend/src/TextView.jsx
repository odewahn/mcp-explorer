import React, { useEffect, useRef, useState } from "react";
import { Button, Box, Snackbar } from "@mui/material";
import { ContentCopy } from "@mui/icons-material";
// You'll need to install: npm install react-markdown
import ReactMarkdown from "react-markdown";

function TextView({ data }) {
  const containerRef = useRef(null);
  const [text, setText] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  // Scroll to bottom whenever data changes
  useEffect(() => {
    if (containerRef.current) {
      const timer = setTimeout(() => {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data]);

  // Also scroll when component mounts
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // When the page loads set the text to be the messages
  useEffect(() => {
    let out = "";
    // Iterate through the data and add each message to the text
    for (let i = 0; i < data["messages"].length; i++) {
      var msg = data["messages"][i].content;
      // If messages begins with "Tool result: [TextContent" then just show the first 50 characters
      if (msg.startsWith("Tool result:")) {
        msg = "<tool results>...</tool results>";
      }
      out += "**" + data["messages"][i].role + "**:  " + msg + "\n\n";
    }
    setText(out);
  }, [data]);

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
      {/* Copy Button */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          backgroundColor: "#f5f5f5",
          borderBottom: "1px solid #e0e0e0",
          padding: "8px 16px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
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
