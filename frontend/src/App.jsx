import { useState, useEffect } from "react";
import { Tabs, Tab, Box, CircularProgress } from "@mui/material";
import InputMessage from "./InputMessage";
import JSONView from "./JSONView";
import MessageView from "./MessageView";
import TextView from "./TextView";
import { API_BASE_URL } from "./apiConfig";

function App() {
  const [messages, setMessages] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Load messages when component mounts
  useEffect(() => {
    // Set a flag to ensure we only initialize once
    if (!initialized) {
      loadMessages();
      setInitialized(true);
    }
  }, [initialized]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Load messages from the server
  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/messages`);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box sx={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100%",
    }}>

      {/* Tabs and Content Area - Fixed height with scrolling */}
      <Box sx={{ 
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0, // Important for proper flexbox behavior
        overflow: "hidden" // Prevent outer container from scrolling
      }}>
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "#e0e0e0",
            backgroundColor: "#ffffff",
            borderRadius: "4px 4px 0 0",
            px: 2,
            flexShrink: 0, // Prevent tabs from shrinking
          }}
        >
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="view tabs"
            sx={{
              "& .MuiTabs-indicator": {
                backgroundColor: "#1976d2",
                height: 3,
              },
            }}
          >
            <Tab
              label="Message View"
              sx={{
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.9rem",
              }}
            />
            <Tab
              label="JSON View"
              sx={{
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.9rem",
              }}
            />
            <Tab
              label="Text View"
              sx={{
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.9rem",
              }}
            />
          </Tabs>
        </Box>

        {/* Content area with fixed height and scrolling */}
        <Box sx={{ 
          flexGrow: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0 // Important for proper flexbox behavior
        }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {tabValue === 0 && <MessageView data={messages} />}
              {tabValue === 1 && <JSONView data={messages} />}
              {tabValue === 2 && <TextView data={messages} />}
            </>
          )}
        </Box>
      </Box>

      {/* Input Message - Fixed at bottom */}
      <Box sx={{ flexShrink: 0, mt: 2 }}>
        <InputMessage onNewMessage={loadMessages} />
      </Box>
    </Box>
  );
}

export default App;
