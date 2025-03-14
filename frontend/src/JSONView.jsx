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
        padding: "10px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        scrollBehavior: "auto",
      }}
    >
      <JsonView
        data={data}
        shouldExpandNode={allExpanded}
        style={defaultStyles}
      />
    </div>
  );
}

export default JSONView;
