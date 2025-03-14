import React, { useEffect, useRef } from "react";
import {
  JsonView,
  allExpanded,
  darkStyles,
  defaultStyles,
} from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

function JSONView({ data }) {
  const containerRef = useRef(null);

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

  // Also scroll when component mounts
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flexGrow: 1,
        height: "100%",
        overflowY: "auto",
        padding: "16px",
        backgroundColor: "#f5f5f5",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        scrollBehavior: "auto",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <JsonView
        data={data}
        shouldExpandNode={allExpanded}
        style={{
          ...defaultStyles,
          container: "position:relative;",
          basicChildStyle: "margin-left:1.5rem;",
          punctuation: "color:#666;",
          attributeKey: "color:#1976d2;font-weight:500;",
          attributeValue: "color:#333;",
          stringValue: "color:#2e7d32;",
          numberValue: "color:#d32f2f;",
          booleanValue: "color:#7b1fa2;",
          nullValue: "color:#999;",
        }}
      />
    </div>
  );
}

export default JSONView;
