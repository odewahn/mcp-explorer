import React, { useState, useEffect } from "react";
import { 
  IconButton, 
  CircularProgress, 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel 
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import "./InputMessage.css";

// A react component that allows the user to type a message and then post it to
// the messages endpoint of the server.
function InputMessage({ onNewMessage, systemPrompt }) {
  const [message, setMessage] = useState("");
  const [spinner, setSpinner] = useState(false);
  const [model, setModel] = useState("claude-3-5-sonnet-20241022");
  
  // Available models
  const models = [
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307"
  ];

  // This function is called when the user clicks the "Send" button or presses Enter.
  // It sends the message to the server.
  const sendMessage = async (message) => {
    if (message.length === 0) {
      return;
    }

    // Show the spinner
    setSpinner(true);

    try {
      // Send the message to the server
      const response = await fetch("http://0.0.0.0:8000/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          text: message,
          model: model,
          system_prompt: systemPrompt || "You are Claude, an AI assistant. Be helpful, harmless, and honest."
        }),
      });
      
      if (!response.ok) {
        // Try to get the error details from the response
        let errorDetails = "Unknown server error";
        try {
          const errorData = await response.json();
          errorDetails = errorData.detail || "Server error";
        } catch (e) {
          // If we can't parse the JSON, use the status text
          errorDetails = response.statusText;
        }
        
        console.error(`Server error (${response.status}): ${errorDetails}`);
        alert(`Error: ${errorDetails}`);
      } else {
        const data = await response.json();
      }
      
      // Notify parent component that a new message was sent
      onNewMessage();
    } catch (error) {
      console.error("Error sending message:", error);
      alert(`Network error: ${error.message}`);
    } finally {
      setSpinner(false);
    }
  };

  // Handle key down events to detect Enter key
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && message.trim()) {
      e.preventDefault(); // Prevent default Enter behavior (new line)
      sendMessage(message);
      setMessage("");
      
      // Reset the TextField by forcing a blur and focus
      const textField = e.target;
      textField.blur();
      setTimeout(() => textField.focus(), 0);
    }
  };

  // Function to reset the conversation history
  const resetMessages = async () => {
    try {
      const response = await fetch("http://0.0.0.0:8000/reset-messages", {
        method: "POST",
      });
      
      if (response.ok) {
        // Notify parent component that messages have been reset
        onNewMessage();
        console.log("Conversation history has been reset");
      } else {
        console.error("Failed to reset conversation history");
      }
    } catch (error) {
      console.error("Error resetting messages:", error);
    }
  };

  const handleSendClick = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage("");
    }
  };

  return (
    <div className="input-container">
      <div className="model-select-container" style={{ alignSelf: 'flex-start' }}>
        <FormControl variant="outlined" size="small" fullWidth>
          <InputLabel id="model-select-label">Model</InputLabel>
          <Select
            labelId="model-select-label"
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            label="Model"
          >
            {models.map((modelOption) => (
              <MenuItem key={modelOption} value={modelOption}>
                {modelOption}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
      <div className="text-field-container">
        <TextField
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message here..."
          multiline
          fullWidth
          minRows={3}
          maxRows={3}
          variant="outlined"
          size="small"
          autoComplete="off"
          sx={{
            '& .MuiOutlinedInput-root': {
              transition: 'height 0.2s ease-in-out',
            }
          }}
        />
      </div>
      <div className="button-container" style={{ alignSelf: 'flex-start' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSendClick}
          disabled={spinner || !message.trim()}
          endIcon={spinner ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
        >
          Submit
        </Button>
      </div>
      <div className="reset-button-container" style={{ alignSelf: 'flex-start' }}>
        <IconButton 
          onClick={resetMessages} 
          color="error" 
          title="Reset conversation"
          aria-label="Reset conversation"
        >
          <DeleteIcon />
        </IconButton>
      </div>
    </div>
  );
}

export default InputMessage;
