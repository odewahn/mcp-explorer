# Conversation API Structure & React Integration Guide (JavaScript)

## API Response Structure

### Simple Case (No Tool Calls)

```json
{
  "response": "Here's the answer to your question...",
  "conversation_history": [
    {
      "role": "user",
      "content": "What's the weather like?"
    },
    {
      "role": "assistant",
      "content": "Here's the answer to your question..."
    }
  ]
}
```

### Complex Case (With Tool Calls)

```json
{
  "response": "Based on the weather data, it's currently 75°F and sunny in Boston.",
  "conversation_history": [
    {
      "role": "user",
      "content": "What's the weather like in Boston?"
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "tool_use",
          "id": "call_abc123",
          "name": "get_weather",
          "input": {
            "location": "Boston",
            "units": "fahrenheit"
          }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "call_abc123",
          "content": "{\"temperature\": 75, \"condition\": \"sunny\", \"humidity\": 45}",
          "is_error": false
        }
      ]
    },
    {
      "role": "assistant",
      "content": "Based on the weather data, it's currently 75°F and sunny in Boston."
    }
  ]
}
```

## Message Types Reference

### User Messages

```javascript
// Simple user message
{
  role: "user",
  content: "What's the weather?"
}

// User message with tool result
{
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: "call_abc123",
      content: "Weather data here",
      is_error: false
    }
  ]
}
```

### Assistant Messages

```javascript
// Simple assistant message
{
  role: "assistant",
  content: "Here's your answer"
}

// Assistant message with tool call
{
  role: "assistant",
  content: [
    {
      type: "tool_use",
      id: "call_abc123",
      name: "weather_api",
      input: { location: "Boston" }
    }
  ]
}
```

## React Frontend Integration

### 1. Message Rendering Component

```javascript
// components/MessageRenderer.jsx
import React from "react";

const MessageRenderer = ({ message, showToolCalls = false }) => {
  const renderContent = () => {
    // Simple text content
    if (typeof message.content === "string") {
      return (
        <div className={`message ${message.role}`}>
          <div className="message-content">{message.content}</div>
        </div>
      );
    }

    // Complex content with tool calls/results
    return (
      <div className={`message ${message.role}`}>
        {message.content.map((item, index) => {
          if (item.type === "tool_use") {
            return showToolCalls ? (
              <ToolCallDisplay key={index} toolCall={item} />
            ) : null;
          }

          if (item.type === "tool_result") {
            return showToolCalls ? (
              <ToolResultDisplay key={index} toolResult={item} />
            ) : null;
          }

          return null;
        })}
      </div>
    );
  };

  return renderContent();
};

const ToolCallDisplay = ({ toolCall }) => (
  <div className="tool-call">
    <div className="tool-call-header">🔧 Calling {toolCall.name}</div>
    <details className="tool-call-details">
      <summary>Parameters</summary>
      <pre>{JSON.stringify(toolCall.input, null, 2)}</pre>
    </details>
  </div>
);

const ToolResultDisplay = ({ toolResult }) => (
  <div className={`tool-result ${toolResult.is_error ? "error" : "success"}`}>
    <div className="tool-result-header">
      {toolResult.is_error ? "❌" : "✅"} Tool Result
    </div>
    <div className="tool-result-content">{toolResult.content}</div>
  </div>
);

export default MessageRenderer;
```

### 2. Conversation Display Component

```javascript
// components/ConversationDisplay.jsx
import React, { useState } from "react";
import MessageRenderer from "./MessageRenderer";

const ConversationDisplay = ({ messages }) => {
  const [showToolCalls, setShowToolCalls] = useState(false);

  // Filter out tool-only messages for clean display
  const displayMessages = showToolCalls
    ? messages
    : messages.filter((msg) => {
        if (typeof msg.content === "string") return true;
        // Hide pure tool call/result messages
        return false;
      });

  return (
    <div className="conversation">
      <div className="conversation-controls">
        <label>
          <input
            type="checkbox"
            checked={showToolCalls}
            onChange={(e) => setShowToolCalls(e.target.checked)}
          />
          Show tool calls
        </label>
      </div>

      <div className="messages">
        {displayMessages.map((message, index) => (
          <MessageRenderer
            key={index}
            message={message}
            showToolCalls={showToolCalls}
          />
        ))}
      </div>
    </div>
  );
};

export default ConversationDisplay;
```

### 3. API Integration Hook

```javascript
// hooks/useConversation.js
import { useState, useCallback } from "react";

export const useConversation = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (query) => {
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            conversation_history: messages,
          }),
        });

        const data = await response.json();

        // Update with the complete conversation history from backend
        setMessages(data.conversation_history);

        return data.response;
      } catch (error) {
        console.error("Error sending message:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
  }, []);

  // Get just the user-visible messages (no tool calls)
  const getDisplayMessages = useCallback(() => {
    return messages.filter((msg) => typeof msg.content === "string");
  }, [messages]);

  return {
    messages,
    sendMessage,
    clearConversation,
    getDisplayMessages,
    isLoading,
  };
};
```

### 4. Simple Usage Example

```javascript
// components/ChatInterface.jsx
import React, { useState } from "react";
import { useConversation } from "../hooks/useConversation";
import ConversationDisplay from "./ConversationDisplay";

const ChatInterface = () => {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isLoading, getDisplayMessages } =
    useConversation();

  const handleSend = async () => {
    if (!input.trim()) return;

    try {
      await sendMessage(input);
      setInput("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="chat-interface">
      {/* Option 1: Show all messages including tool calls */}
      <ConversationDisplay messages={messages} />

      {/* Option 2: Show only user-visible messages */}
      {/* <ConversationDisplay messages={getDisplayMessages()} /> */}

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          disabled={isLoading}
          placeholder="Type your message..."
        />
        <button onClick={handleSend} disabled={isLoading}>
          {isLoading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
```

## Utility Functions

### Message Processing Helpers

```javascript
// utils/messageUtils.js

// Check if message is user-visible (contains text)
export const isUserVisibleMessage = (message) => {
  return typeof message.content === "string";
};

// Extract text from any message type
export const getMessageText = (message) => {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const toolUse = message.content.find((item) => item.type === "tool_use");
    if (toolUse) return `[Using ${toolUse.name} tool...]`;

    const toolResult = message.content.find(
      (item) => item.type === "tool_result"
    );
    if (toolResult)
      return toolResult.is_error ? "[Tool error]" : "[Tool completed]";
  }

  return "[System message]";
};

// Get summary of conversation
export const getConversationSummary = (messages) => {
  return {
    total: messages.length,
    textMessages: messages.filter((msg) => typeof msg.content === "string")
      .length,
    toolMessages: messages.filter((msg) => Array.isArray(msg.content)).length,
  };
};

// Filter to only text messages
export const getTextOnlyMessages = (messages) => {
  return messages.filter(isUserVisibleMessage);
};

// Get tool activity from messages
export const getToolActivity = (messages) => {
  return messages
    .filter((msg) => Array.isArray(msg.content))
    .map((msg) => ({
      role: msg.role,
      tools: msg.content.map((item) => ({
        type: item.type,
        name: item.name || "result",
        success: item.type === "tool_result" ? !item.is_error : null,
      })),
    }));
};
```

## Backend Response Format

Update your backend to return both the response and conversation history:

```python
# In your API endpoint
async def chat_endpoint(request):
    data = await request.json()
    query = data['query']
    existing_history = data.get('conversation_history', [])

    processor = QueryProcessor(
        anthropic_client=anthropic_client,
        available_tools=available_tools,
        tool_servers=tool_servers,
        existing_conversation=existing_history
    )

    response = await processor.process_query(system_prompt, query)

    return {
        "response": response,  # Just the final text response
        "conversation_history": processor.get_conversation_history()  # Full structured history
    }
```

## Migration Strategy

### Phase 1: Backward Compatibility

Keep both old and new formats:

```python
return {
    "response": response,
    "conversation_history": processor.get_conversation_history(),
    "simple_history": [  # For backward compatibility
        {"role": msg["role"], "content": str(msg["content"])}
        for msg in processor.get_conversation_history()
        if isinstance(msg["content"], str)
    ]
}
```

### Phase 2: Frontend Updates

```javascript
// Update your existing chat component gradually
const ExistingChatComponent = () => {
  const [messages, setMessages] = useState([]);

  const sendMessage = async (query) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, conversation_history: messages }),
    });

    const data = await response.json();

    // Use new format if available, fall back to old
    if (data.conversation_history) {
      setMessages(data.conversation_history);
    } else {
      // Handle old format
      setMessages((prev) => [
        ...prev,
        { role: "user", content: query },
        { role: "assistant", content: data.response },
      ]);
    }

    return data.response;
  };

  // Rest of component...
};
```

### Phase 3: Full Migration

Remove backward compatibility once frontend is updated.

## CSS Classes Used

```css
/* Basic structure classes */
.conversation {
  /* Main container */
}
.conversation-controls {
  /* Header with toggles */
}
.messages {
  /* Message list container */
}
.message {
  /* Individual message */
}
.message-user {
  /* User messages */
}
.message-assistant {
  /* Assistant messages */
}

/* Tool-specific classes */
.tool-call {
  /* Tool call display */
}
.tool-result {
  /* Tool result display */
}
.tool-result.error {
  /* Error state */
}
.tool-result.success {
  /* Success state */
}

/* Input area */
.input-area {
  /* Input container */
}
.chat-interface {
  /* Full interface wrapper */
}
```

This structure gives you complete control over how conversations are displayed while maintaining clean separation between user-facing content and internal tool operations.
