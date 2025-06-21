import React, { useEffect, useRef, useState } from "react";
import AceEditor from "react-ace";

// Import ace modes and themes
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";

function JSONView({ data }) {
  const containerRef = useRef(null);
  const [formattedJson, setFormattedJson] = useState("");

  // Format the JSON data whenever it changes
  useEffect(() => {
    try {
      // Convert data to a formatted JSON string with 2 spaces indentation
      const formatted = JSON.stringify(data, null, 2);
      setFormattedJson(formatted);
    } catch (error) {
      console.error("Error formatting JSON:", error);
      setFormattedJson(JSON.stringify({ error: "Invalid JSON data" }, null, 2));
    }
  }, [data]);

  // Scroll to bottom whenever data changes
  useEffect(() => {
    if (containerRef.current) {
      // Force scroll to bottom with a slight delay to ensure rendering is complete
      const timer = setTimeout(() => {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{
        flexGrow: 1,
        height: "100%",
        overflowY: "auto",
        backgroundColor: "#f5f5f5",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        display: "flex",
        flexDirection: "column",
        minHeight: 0, // Important for proper flexbox behavior
      }}
    >
      <AceEditor
        mode="json"
        theme="github"
        name="json-viewer"
        value={formattedJson}
        readOnly={true}
        width="100%"
        height="100%"
        showPrintMargin={false}
        showGutter={true}
        highlightActiveLine={false}
        setOptions={{
          showLineNumbers: true,
          tabSize: 2,
          useWorker: false, // Disable syntax validation worker
          wrap: true, // Enable text wrapping
        }}
        editorProps={{ $blockScrolling: Infinity }}
        style={{ 
          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace",
          fontSize: "14px"
        }}
      />
    </div>
  );
}

export default JSONView;
