import { useState, useEffect } from "react";
import { Tabs, Tab, Box } from "@mui/material";
import InputMessage from "./InputMessage";
import JSONView from "./JSONView";
import MessageView from "./MessageView";
import SystemPrompt from "./SystemPrompt";

/*
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/theme-github";


import "react-json-view-lite/dist/index.css";


      <AceEditor
        mode="text"
        theme="github"
        name="completionEditor"
        value={JSON.stringify(messages, null, 2)}
        readOnly={true}
        width="100%"
        height="300px"
        fontSize={16}
        setOptions={{
          useWorker: false,
          showLineNumbers: false,
          showGutter: false,
          tabSize: 2,
          wrap: true, // Enable line wrapping
          indentedSoftWrap: false,
        }}
      />
*/

function App() {
  const [messages, setMessages] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    loadMessages();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // It sends the message to the server.
  const loadMessages = async () => {
    // Send the message to the server
    const response = await fetch("http://0.0.0.0:8000/messages")
      .then((response) => response.json())
      .then((data) => {
        setMessages(data);
      });
  };

  // Handle system prompt changes
  const handleSystemPromptChange = (newPrompt) => {
    setSystemPrompt(newPrompt);
  };

  return (
    <div>
      <SystemPrompt onSystemPromptChange={handleSystemPromptChange} />
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="view tabs">
          <Tab label="Message View" />
          <Tab label="JSON View" />
        </Tabs>
      </Box>
      
      {tabValue === 0 && <MessageView data={messages} />}
      {tabValue === 1 && <JSONView data={messages} />}
      
      <InputMessage onNewMessage={loadMessages} systemPrompt={systemPrompt} />
    </div>
  );
}

export default App;
