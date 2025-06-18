import { useState, useEffect } from "react";
import { Tabs, Tab, Box, CircularProgress } from "@mui/material";
import InputMessage from "./InputMessage";
import JSONView from "./JSONView";
import MessageView from "./MessageView";
import TextView from "./TextView";
import SystemPrompt from "./SystemPrompt";

function App() {
  const [messages, setMessages] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState("");
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
      const response = await fetch("http://0.0.0.0:8000/messages");
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle system prompt changes
  const handleSystemPromptChange = (newPrompt) => {
    setSystemPrompt(newPrompt);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SystemPrompt onSystemPromptChange={handleSystemPromptChange} />

      <Box
        sx={{
          borderBottom: 1,
          borderColor: "#e0e0e0",
          mb: 2,
          backgroundColor: "#ffffff",
          borderRadius: "4px 4px 0 0",
          px: 2,
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

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", my: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tabValue === 0 && <MessageView data={messages} />}
          {tabValue === 1 && <JSONView data={messages} />}
          {tabValue === 2 && <TextView data={messages} />}
        </>
      )}

      <InputMessage onNewMessage={loadMessages} systemPrompt={systemPrompt} />
    </Box>
  );
}

export default App;
